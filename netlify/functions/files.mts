import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { putBlob, getBlob, deleteBlob } from '../../server/blobs';
import { readImage } from '../../server/upload';
import type { Submission, User } from '../../server/db/schema';

const Meta = z.object({
  submissionId: z.uuid(),
  fieldId: z.string().trim().min(1).max(100),
  kind: z.enum(['photo', 'signature', 'drawing']),
});
const Id = z.uuid();

async function loadSubmission(id: string) {
  const [s] = await getDb().select().from(schema.submissions).where(eq(schema.submissions.id, id));
  if (!s) throw new HttpError(404, 'הטופס לא נמצא');
  return s;
}

// owner while draft/returned; admin while under review
function canEdit(me: User, s: Submission) {
  if (me.role === 'admin') return s.status === 'submitted' || s.inspectorId === me.id && ['draft', 'returned'].includes(s.status);
  return s.inspectorId === me.id && ['draft', 'returned'].includes(s.status);
}

export default handle(async (req) => {
  const me = await requireUser(req);
  const db = getDb();
  const id = new URL(req.url).pathname.split('/')[3];

  if (!id) {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const form = await req.formData();
    const meta = Meta.safeParse({
      submissionId: form.get('submissionId'),
      fieldId: form.get('fieldId'),
      kind: form.get('kind'),
    });
    if (!meta.success) throw new HttpError(400, 'נתונים לא תקינים', { issues: meta.error.issues });
    const s = await loadSubmission(meta.data.submissionId);
    if (!canEdit(me, s)) throw new HttpError(403, 'אין הרשאה');
    const img = await readImage(form.get('file'));
    const key = `att/${s.id}/${crypto.randomUUID()}`;
    await putBlob(key, img.bytes, img.type);
    const [row] = await db
      .insert(schema.attachments)
      .values({ submissionId: s.id, fieldId: meta.data.fieldId, kind: meta.data.kind, blobKey: key })
      .returning();
    // inspector work: keep on job cancel
    if (!s.touchedAt) await db.update(schema.submissions).set({ touchedAt: new Date() }).where(eq(schema.submissions.id, s.id));
    return json({ id: row.id, url: `/api/files/${row.id}` }, 201);
  }

  if (!Id.safeParse(id).success) throw new HttpError(404, 'הקובץ לא נמצא');
  const [att] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id));
  if (!att) throw new HttpError(404, 'הקובץ לא נמצא');
  const s = await loadSubmission(att.submissionId);

  if (req.method === 'GET') {
    if (me.role !== 'admin' && s.inspectorId !== me.id) throw new HttpError(403, 'אין הרשאה');
    const b = await getBlob(att.blobKey);
    if (!b) throw new HttpError(404, 'הקובץ לא נמצא');
    return new Response(b.data, { headers: { 'content-type': b.contentType, 'cache-control': 'private, max-age=86400' } });
  }
  if (req.method === 'DELETE') {
    if (!canEdit(me, s)) throw new HttpError(403, 'אין הרשאה');
    await db.delete(schema.attachments).where(eq(schema.attachments.id, id));
    await deleteBlob(att.blobKey);
    return json({ ok: true });
  }
  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = { path: ['/api/files', '/api/files/:id'] };
