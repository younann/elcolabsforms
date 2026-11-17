import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { putBlob } from '../../server/blobs';
import { readPngBody } from '../../server/upload';

const Put = z.object({
  recipientEmail: z.union([z.literal(''), z.email()]),
  companyName: z.string().trim().max(120),
  companyDetails: z.string().trim().max(1000),
});

export async function loadSettings() {
  const db = getDb();
  const [s] = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
  if (s) return s;
  const [created] = await db.insert(schema.settings).values({ id: 1 }).returning();
  return created;
}

export default handle(async (req) => {
  const url = new URL(req.url);
  const db = getDb();
  if (url.pathname.endsWith('/stamp')) {
    await requireUser(req, 'admin');
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
