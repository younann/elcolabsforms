import { internalKeyOk } from '../../server/pdf';
import { runCertificate } from '../../server/certificates';

export default async (req: Request) => {
  if (req.method !== 'POST' || !internalKeyOk(req.headers.get('x-internal-key'))) {
    console.warn('certificate-background: rejected request');
    return new Response('forbidden', { status: 403 });
  }
  let id = '';
  try {
    id = String(((await req.json()) as { id?: unknown }).id ?? '');
  } catch {
    // bad body
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('bad request', { status: 400 });
  await runCertificate(id).catch((e) => console.error('certificate run failed', id, e));
  return new Response(null, { status: 202 });
};
