import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { and, asc, desc, eq, isNotNull, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { getBlob, putBlob } from '../../server/blobs';
import { docxKey } from '../../server/docx';
import { DOCX_TYPE, loadReportAssets, renderDocxFor, reportFileBase } from '../../server/report-assets';
import { FORMS, getForm } from '../../shared/forms';
import { canTransition } from '../../shared/status';
import {
  asData,
  assertAccess,
  audit,
  changedFieldIds,
  duplicateData,
  loadSubmission,
  mirror,
} from '../../server/submissions';

const Create = z.object({ formId: z.enum(FORMS.map((f) => f.id) as [string, ...string[]]) });
const Patch = z.object({ data: z.record(z.string(), z.unknown()), updatedAt: z.string() });
const Id = z.uuid();

export default handle(async (req) => {
  const me = await requireUser(req);
  const db = getDb();
  const parts = new URL(req.url).pathname.split('/'); // ['', 'api', 'submissions', id, sub]
  const id = parts[3];
  const sub = parts[4];

  if (!id) {
    if (req.method === 'GET') {
      const q = new URL(req.url).searchParams;
      const conds: SQL[] = [];
      if (q.get('status')) conds.push(eq(schema.submissions.status, q.get('status')!));
      if (q.get('formId')) conds.push(eq(schema.submissions.formId, q.get('formId')!));
      const inspectorId = me.role === 'admin' ? q.get('inspectorId') : me.id;
      if (inspectorId) {
        if (!Id.safeParse(inspectorId).success) throw new HttpError(400, 'נתונים לא תקינים');
        conds.push(eq(schema.submissions.inspectorId, inspectorId));
      }
      const rows = await db
        .select({
          id: schema.submissions.id,
          formId: schema.submissions.formId,
          status: schema.submissions.status,
          testNumber: schema.submissions.testNumber,
          siteName: schema.submissions.siteName,
          revision: schema.submissions.revision,
          parentId: schema.submissions.parentId,
          reviewNote: schema.submissions.reviewNote,
          sendError: schema.submissions.sendError,
          hasPdf: isNotNull(schema.submissions.pdfKey),
          hasChild: sql<boolean>`exists (select 1 from ${schema.submissions} c where c.parent_id = ${schema.submissions.id})`,
          inspectorId: schema.submissions.inspectorId,
          inspectorName: schema.users.displayName,
          submittedAt: schema.submissions.submittedAt,
          emailedAt: schema.submissions.emailedAt,
          createdAt: schema.submissions.createdAt,
          updatedAt: schema.submissions.updatedAt,
        })
        .from(schema.submissions)
        .innerJoin(schema.users, eq(schema.users.id, schema.submissions.inspectorId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(schema.submissions.updatedAt));
      return json({ submissions: rows });
    }
    if (req.method === 'POST') {
      const b = await parseBody(req, Create);
      const def = getForm(b.formId);
      const [row] = await db
        .insert(schema.submissions)
        .values({ formId: def.id, formVersion: def.version, inspectorId: me.id, updatedAt: new Date() })
        .returning();
      await audit(row.id, me.id, 'create');
      return json({ submission: row }, 201);
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (!Id.safeParse(id).success) throw new HttpError(404, 'הטופס לא נמצא');
  const s = await loadSubmission(id);
  assertAccess(me, s);

  if (sub === 'duplicate') {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const def = getForm(s.formId, s.formVersion);
    const data = duplicateData(def, asData(s.data));
    const [row] = await db
      .insert(schema.submissions)
      .values({
        formId: s.formId,
        formVersion: s.formVersion,
        inspectorId: s.inspectorId,
        data,
        ...mirror(data),
        updatedAt: new Date(),
      })
      .returning();
    await audit(row.id, me.id, 'create', { note: `duplicate of ${s.id}` });
    return json({ submission: row }, 201);
  }
  if (sub === 'pdf') {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    // owner only once emailed
    if (me.role !== 'admin' && s.status !== 'emailed') throw new HttpError(403, 'אין הרשאה');
    const b = s.pdfKey ? await getBlob(s.pdfKey) : null;
    if (!b) throw new HttpError(404, 'הדוח לא נמצא');
    const name = `${s.testNumber || s.id}${s.revision > 0 ? `-Rev${s.revision}` : ''}`.replace(/[\\/:*?"<>|\s]+/g, '_');
    return new Response(b.data, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
        'cache-control': 'private, no-store',
      },
    });
  }
  if (sub === 'docx') {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    // same rules as the pdf
    if (me.role !== 'admin' && s.status !== 'emailed') throw new HttpError(403, 'אין הרשאה');
    if (!s.pdfKey) throw new HttpError(404, 'הדוח לא נמצא');
    const key = docxKey(s.id, s.revision);
    const b = await getBlob(key);
    let body: Buffer;
    if (b) body = Buffer.from(b.data);
    else {
      // reports sent before word support, or a failed word build
      body = await renderDocxFor(s, await loadReportAssets(s));
      await putBlob(key, body, DOCX_TYPE).catch((e) => console.error('docx cache failed', s.id, e));
    }
    return new Response(new Uint8Array(body), {
      headers: {
        'content-type': DOCX_TYPE,
        'content-disposition': `attachment; filename="report.docx"; filename*=UTF-8''${encodeURIComponent(reportFileBase(s))}.docx`,
        'cache-control': 'private, no-store',
      },
    });
  }
  if (sub) throw new HttpError(404, 'לא נמצא');

  if (req.method === 'GET') {
    const attachments = await db.select().from(schema.attachments).where(eq(schema.attachments.submissionId, id));
    const out: Record<string, unknown> = {
      submission: s,
      attachments: attachments.map((a) => ({ id: a.id, fieldId: a.fieldId, kind: a.kind, url: `/api/files/${a.id}` })),
    };
    if (me.role === 'admin') {
      out.audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.submissionId, id)).orderBy(asc(schema.auditLog.at));
    }
    return json(out);
  }

  if (req.method === 'PATCH') {
    const b = await parseBody(req, Patch);
    const owner = s.inspectorId === me.id;
    // inspector: own draft/returned; admin: submitted
    const allowed = canTransition(s.status as never, 'edit', me.role) !== null && (me.role === 'admin' || owner);
    if (!allowed) throw new HttpError(403, 'אין הרשאה');
    const ts = new Date(b.updatedAt);
    if (Number.isNaN(ts.getTime()) || ts.getTime() !== s.updatedAt.getTime()) {
      throw new HttpError(409, 'הטופס עודכן, רענן ונסה שוב');
    }
    const rows = await db
      .update(schema.submissions)
      .set({ data: b.data, ...mirror(b.data), updatedAt: new Date() })
      .where(and(eq(schema.submissions.id, id), eq(schema.submissions.status, s.status), eq(schema.submissions.updatedAt, s.updatedAt)))
      .returning();
    if (!rows[0]) throw new HttpError(409, 'הטופס עודכן, רענן ונסה שוב');
    if (me.role === 'admin') {
      const old = asData(s.data);
      const ids = changedFieldIds(old, b.data);
      if (ids.length) {
        await db.insert(schema.auditLog).values(
          ids.map((f) => ({
            submissionId: id,
            userId: me.id,
            action: 'edit',
            fieldId: f,
            oldValue: old[f] ?? null,
            newValue: b.data[f] ?? null,
          })),
        );
      }
    }
    return json({ submission: rows[0] });
  }
  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = { path: ['/api/submissions', '/api/submissions/:id', '/api/submissions/:id/duplicate', '/api/submissions/:id/pdf', '/api/submissions/:id/docx'] };

