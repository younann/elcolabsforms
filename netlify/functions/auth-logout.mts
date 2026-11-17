import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json } from '../../server/http';
import { readSid, clearCookie } from '../../server/auth';

export default handle(async (req) => {
  const sid = readSid(req);
  if (sid) await getDb().delete(schema.sessions).where(eq(schema.sessions.id, sid));
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
});

export const config: Config = { path: '/api/auth/logout', method: 'POST' };
