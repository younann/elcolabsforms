import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { getBlob, putBlob } from '../../server/blobs';
import { AiAsk } from '../../shared/ai';

const aiKey = (id: string) => `ai/${id}.json`;

// answers can outlast a normal request, so a background run writes them
export default handle(async (req) => {
  const me = await requireUser(req);
  const id = new URL(req.url).pathname.split('/')[3];

  if (!id && req.method === 'POST') {
    if (!process.env.GEMINI_API_KEY) throw new HttpError(503, 'עוזר ה-AI עדיין לא הוגדר');
    const b = await parseBody(req, AiAsk);
    const qid = crypto.randomUUID();
    await putBlob(aiKey(qid), Buffer.from(JSON.stringify({ userId: me.id, ...b, status: 'pending' })), 'application/json');
    const base = process.env.APP_URL || new URL(req.url).origin;
    const r = await fetch(`${base}/.netlify/functions/ai-background`, { method: 'POST', headers: { 'x-internal-key': process.env.INTERNAL_KEY ?? '' }, body: JSON.stringify({ id: qid }) }).catch(() => null);
    if (!r?.ok) throw new HttpError(502, 'ה-AI לא זמין כרגע. נסו שוב בעוד רגע');
    return json({ id: qid }, 202);
  }

  if (id && req.method === 'GET') {
    if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'השאלה לא נמצאה');
    const b = await getBlob(aiKey(id));
    const q = b && (JSON.parse(Buffer.from(b.data).toString('utf8')) as { userId: string; status: string; text?: string; sources?: unknown; error?: string });
    if (!q || q.userId !== me.id) throw new HttpError(404, 'השאלה לא נמצאה');
    return json({ status: q.status, text: q.text, sources: q.sources, error: q.error });
  }

  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = { path: ['/api/ai', '/api/ai/:id'] };
