import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { getForm } from '../../shared/forms';
import { validateForSubmit } from '../../shared/forms/validate';
import { canTransition, type Status } from '../../shared/status';
import { getBlob, putBlob } from '../../server/blobs';
import { notifySubmitted } from '../../server/mail';
import { asData, assertAccess, audit, loadSubmission, transition, triggerReport } from '../../server/submissions';

const Body = z.object({
  action: z.enum(['submit', 'return', 'approve', 'reopen', 'retry']),
  note: z.string().trim().max(2000).optional(),
});

export default handle(async (req) => {
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
  const to = canTransition(from, action, me.role);
  if (!to) throw new HttpError(409, 'פעולה לא אפשרית במצב הנוכחי');

  if (action === 'submit') {
    if (s.inspectorId !== me.id) throw new HttpError(403, 'אין הרשאה');
    const def = getForm(s.formId, s.formVersion);
    const atts = await db.select().from(schema.attachments).where(eq(schema.attachments.submissionId, id));
    const v = validateForSubmit(def, asData(s.data), atts.map((a) => ({ id: a.id, fieldId: a.fieldId, kind: a.kind })));
    if (!v.ok) throw new HttpError(422, 'חסרים שדות חובה', { missing: v.missing });
    const row = await transition(id, from, { status: to, submittedAt: new Date(), reviewNote: null });
    await audit(id, me.id, 'submit');
    await notifySubmitted(row, def, me.displayName);
    return json({ submission: row });
  }

  if (action === 'return') {
    if (!note) throw new HttpError(400, 'נדרשת הערה');
    const row = await transition(id, from, { status: to, reviewNote: note });
    await audit(id, me.id, 'return', { note });
    return json({ submission: row });
  }

  if (action === 'approve') {
    const row = await transition(id, from, { status: to, approvedBy: me.id, approvedAt: new Date(), sendError: null });
    await audit(id, me.id, 'approve', { note });
    triggerReport(req, id);
    return json({ submission: row });
  }

  if (action === 'retry') {
    const row = await transition(id, from, { status: to, sendError: null });
    await audit(id, me.id, 'retry');
    triggerReport(req, id);
    return json({ submission: row });
  }

  // reopen: copy into a new revision
  const [child] = await db.select({ id: schema.submissions.id }).from(schema.submissions).where(eq(schema.submissions.parentId, id));
  if (child) throw new HttpError(409, 'כבר נפתחה גרסה חדשה');
  const [row] = await db
    .insert(schema.submissions)
    .values({
      formId: s.formId,
      formVersion: s.formVersion,
      inspectorId: s.inspectorId,
      status: 'submitted',
      data: s.data,
      revision: s.revision + 1,
      parentId: s.id,
      testNumber: s.testNumber,
      siteName: s.siteName,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  const atts = await db.select().from(schema.attachments).where(eq(schema.attachments.submissionId, id));
  for (const a of atts) {
    const b = await getBlob(a.blobKey);
    if (!b) continue;
    const key = `att/${row.id}/${crypto.randomUUID()}`;
    await putBlob(key, b.data, b.contentType);
    await db.insert(schema.attachments).values({ submissionId: row.id, fieldId: a.fieldId, kind: a.kind, blobKey: key });
  }
  await audit(id, me.id, 'reopen', { note: `revision ${row.revision}: ${row.id}` });
  await audit(row.id, me.id, 'reopen', { note: `from ${id}` });
  return json({ submission: row }, 201);
});

export const config: Config = { path: '/api/submissions/:id/action' };
