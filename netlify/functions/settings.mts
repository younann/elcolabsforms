import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { getBlob, putBlob } from '../../server/blobs';
import { readPngBody } from '../../server/upload';
import { loadSettings } from '../../server/settings';

const Put = z.object({
  recipientEmail: z.union([z.literal(''), z.email()]),
  companyName: z.string().trim().max(120),
  companyDetails: z.string().trim().max(1000),
});

export { loadSettings };

export default handle(async (req) => {
  const url = new URL(req.url);
  const db = getDb();
  if (url.pathname.endsWith('/stamp')) {
    await requireUser(req, 'admin');
    if (req.method === 'GET') {
      const s = await loadSettings();
      const b = s.stampKey ? await getBlob(s.stampKey) : null;
      if (!b) throw new HttpError(404, 'אין חותמת');
      return new Response(b.data, { headers: { 'content-type': b.contentType, 'cache-control': 'private, no-store' } });
    }
    if (req.method !== 'PUT') throw new HttpError(405, 'Method not allowed');
    const img = await readPngBody(req);
    const key = `stamp/${Date.now()}`;
    await putBlob(key, img.bytes, img.type);
    await loadSettings();
    await db.update(schema.settings).set({ stampKey: key }).where(eq(schema.settings.id, 1));
    return json({ ok: true });
  }
  if (req.method === 'GET') {
    const me = await requireUser(req);
    const s = await loadSettings();
    const base = { companyName: s.companyName, companyDetails: s.companyDetails, hasStamp: !!s.stampKey };
    return json({ settings: me.role === 'admin' ? { ...base, recipientEmail: s.recipientEmail } : base });
  }
  if (req.method === 'PUT') {
    await requireUser(req, 'admin');
    const b = await parseBody(req, Put);
    await loadSettings();
    await db.update(schema.settings).set(b).where(eq(schema.settings.id, 1));
    return json({ ok: true });
  }
  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = { path: ['/api/settings', '/api/settings/stamp'] };
