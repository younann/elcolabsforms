import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { background, handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { getForm } from '../../shared/forms';
import { validateForSubmit } from '../../shared/forms/validate';
import { canTransition, type Status } from '../../shared/status';
import { getBlob, putBlob } from '../../server/blobs';
import { notifySubmitted } from '../../server/mail';
import { asData, assertAccess, auditSafe, loadSubmission, transition, triggerReport } from '../../server/submissions';

const Body = z.object({
  action: z.enum(['submit', 'return', 'approve', 'reopen', 'retry']),
  note: z.string().trim().max(2000).optional(),
});

export default handle(async (req, ctx) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const me = await requireUser(req);
  const id = new URL(req.url).pathname.split('/')[3];
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'הטופס לא נמצא');
  const { action, note } = await parseBody(req, Body);
  const db = getDb();
  const s = await loadSubmission(id);
  assertAccess(me, s);
  if (action !== 'submit' && me.role !== 'admin') throw new HttpError(403, 'אין הרשאה');
  const from = s.status as Status;
  const to = canTransition(from, action, me.role, s.updatedAt, Date.now(), s.mailLogged);
  if (!to) throw new HttpError(409, 'פעולה לא אפשרית במצב הנוכחי');

  const check = async () => {
    const def = getForm(s.formId, s.formVersion);
    const atts = await db.select().from(schema.attachments).where(eq(schema.attachments.submissionId, id));
    const v = validateForSubmit(def, asData(s.data), atts.map((a) => ({ id: a.id, fieldId: a.fieldId, kind: a.kind })));
    if (!v.ok) throw new HttpError(422, 'חסרים שדות חובה', { missing: v.missing });
    return def;
  };

  if (action === 'submit') {
    if (s.inspectorId !== me.id) throw new HttpError(403, 'אין הרשאה');
    const def = await check();
    const row = await transition(id, from, { status: to, submittedAt: new Date(), reviewNote: null }, s.updatedAt);
    // smtp must not delay the reply
    background(ctx, notifySubmitted(row, def, me.displayName));
    await auditSafe(id, me.id, 'submit');
    return json({ submission: row });
  }

  if (action === 'return') {
    if (!note) throw new HttpError(400, 'נדרשת הערה');
    const row = await transition(id, from, { status: to, reviewNote: note });
    await auditSafe(id, me.id, 'return', { note });
    return json({ submission: row });
  }

  if (action === 'approve') {
    await check();
    const row = await transition(id, from, { status: to, approvedBy: me.id, approvedAt: new Date(), sendError: null });
    await triggerReport(req, id);
    await auditSafe(id, me.id, 'approve', { note });
    return json({ submission: row });
  }

  if (action === 'retry') {
    if (from === 'emailed') {
      // a newer revision replaces this report
      const [child] = await db.select({ id: schema.submissions.id }).from(schema.submissions).where(eq(schema.submissions.parentId, id));
      if (child) throw new HttpError(409, 'כבר נפתחה גרסה חדשה');
    }
    // stuck sending: also guard on updatedAt
    const row = await transition(id, from, { status: to, sendError: null }, from === 'sending' ? s.updatedAt : undefined);
    await triggerReport(req, id);
    await auditSafe(id, me.id, 'retry');
    return json({ submission: row });
  }

  // reopen: draft row, copy attachments, then submit last
  const [child] = await db.select({ id: schema.submissions.id }).from(schema.submissions).where(eq(schema.submissions.parentId, id));
  if (child) throw new HttpError(409, 'כבר נפתחה גרסה חדשה');
  let draft;
  try {
    [draft] = await db
      .insert(schema.submissions)
      .values({
        formId: s.formId,
        formVersion: s.formVersion,
        inspectorId: s.inspectorId,
        status: 'draft',
        data: s.data,
        revision: s.revision + 1,
        parentId: s.id,
        jobId: s.jobId,
        jobCopy: s.jobCopy,
        testNumber: s.testNumber,
        siteName: s.siteName,
        updatedAt: new Date(),
      })
      .returning();
  } catch (e) {
    // unique parent index: lost the race
    if (/submissions_parent|duplicate key|unique/i.test(String(e)) || /unique/i.test(String((e as { cause?: unknown }).cause))) {
      throw new HttpError(409, 'כבר נפתחה גרסה חדשה');
    }
    throw e;
  }
  try {
    const atts = await db.select().from(schema.attachments).where(eq(schema.attachments.submissionId, id));
    await Promise.all(
      atts.map(async (a) => {
        const b = await getBlob(a.blobKey);
        if (!b) return;
        const key = `att/${draft.id}/${crypto.randomUUID()}`;
        await putBlob(key, b.data, b.contentType);
        await db.insert(schema.attachments).values({ submissionId: draft.id, fieldId: a.fieldId, kind: a.kind, blobKey: key });
      }),
    );
  } catch (e) {
    // drop the half-copied row so reopen can be retried
    await db.delete(schema.submissions).where(eq(schema.submissions.id, draft.id)).catch(() => {});
    throw e;
  }
  const row = await transition(draft.id, 'draft', { status: 'submitted', submittedAt: new Date() });
  await auditSafe(id, me.id, 'reopen', { note: `revision ${row.revision}: ${row.id}` });
  await auditSafe(row.id, me.id, 'reopen', { note: `from ${id}` });
  return json({ submission: row }, 201);
});

export const config: Config = { path: '/api/submissions/:id/action' };
