import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';

const { pushSubscriptions } = schema;
const Endpoint = z.url().startsWith('https://').max(1000);
const Subscribe = z.object({ endpoint: Endpoint, keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) });
const Unsubscribe = z.object({ endpoint: Endpoint });

export default handle(async (req) => {
  const me = await requireUser(req);
  const path = new URL(req.url).pathname;

  if (path === '/api/push/key' && req.method === 'GET') {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) throw new HttpError(503, 'התראות לא זמינות');
    return json({ key });
  }

  if (path === '/api/push/subscribe') {
    const db = getDb();
    if (req.method === 'POST') {
      const b = await parseBody(req, Subscribe);
      // same device, new login moves to this user
      const row = { userId: me.id, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth };
      await db.insert(pushSubscriptions).values(row).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: row });
      return json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const b = await parseBody(req, Unsubscribe);
      await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, b.endpoint), eq(pushSubscriptions.userId, me.id)));
      return json({ ok: true });
    }
  }

  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = { path: ['/api/push/key', '/api/push/subscribe'] };
