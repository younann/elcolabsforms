import { internalKeyOk } from '../../server/pdf';
import { getBlob, putBlob } from '../../server/blobs';
import { AiError, askGemini } from '../../server/ai';
import type { AiMessage } from '../../shared/ai';

const key = (id: string) => `ai/${id}.json`;

export default async (req: Request) => {
  if (req.method !== 'POST' || !internalKeyOk(req.headers.get('x-internal-key'))) return new Response('forbidden', { status: 403 });
  let id = '';
  try {
    id = String(((await req.json()) as { id?: unknown }).id ?? '');
  } catch {
    // bad body
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('bad request', { status: 400 });
  const b = await getBlob(key(id));
  if (!b) return new Response(null, { status: 202 });
  const q = JSON.parse(Buffer.from(b.data).toString('utf8')) as { userId: string; formId?: string; messages: AiMessage[]; status: string };
  if (q.status !== 'pending') return new Response(null, { status: 202 });
  let done: Record<string, unknown>;
  try {
    done = { status: 'done', ...(await askGemini(q.formId, q.messages)) };
  } catch (e) {
    console.error('ai failed', id, e);
    done = { status: 'failed', error: e instanceof AiError ? e.message : 'ה-AI לא זמין כרגע. נסו שוב בעוד רגע' };
  }
  await putBlob(key(id), Buffer.from(JSON.stringify({ userId: q.userId, formId: q.formId, ...done })), 'application/json');
  return new Response(null, { status: 202 });
};
