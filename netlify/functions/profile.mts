import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, HttpError } from '../../server/http';
import { requireUser, toPublic } from '../../server/auth';
import { putBlob, getBlob } from '../../server/blobs';
import { readPngBody } from '../../server/upload';

export default handle(async (req) => {
  const me = await requireUser(req);
  const url = new URL(req.url);
  if (url.pathname.endsWith('/signature')) {
    if (req.method === 'GET') {
      if (!me.signatureKey) throw new HttpError(404, 'אין חתימה שמורה');
      const b = await getBlob(me.signatureKey);
      if (!b) throw new HttpError(404, 'אין חתימה שמורה');
      return new Response(b.data, { headers: { 'content-type': b.contentType, 'cache-control': 'private, no-store' } });
    }
    if (req.method === 'PUT') {
      const img = await readPngBody(req);
      const key = `signature/${me.id}/${Date.now()}`;
      await putBlob(key, img.bytes, img.type);
      await getDb().update(schema.users).set({ signatureKey: key }).where(eq(schema.users.id, me.id));
      return json({ ok: true });
    }
    throw new HttpError(405, 'Method not allowed');
  }
  return json({ user: toPublic(me) });
});

export const config: Config = { path: ['/api/profile', '/api/profile/signature'] };
