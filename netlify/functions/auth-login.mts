import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { and, eq, gt } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { createSession, sessionCookie, verifyPassword, isRateLimited, toPublic } from '../../server/auth';

const Body = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) });
const BAD = 'שם משתמש או סיסמה שגויים';

export default handle(async (req, ctx) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { username, password } = await parseBody(req, Body);
  const uname = username.toLowerCase();
  const db = getDb();
  const since = new Date(Date.now() - 15 * 60_000);
  const fails = await db
    .select({ at: schema.loginAttempts.at })
    .from(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.username, uname), eq(schema.loginAttempts.ok, false), gt(schema.loginAttempts.at, since)));
  if (isRateLimited(fails.map((f) => f.at), new Date())) {
    throw new HttpError(429, 'יותר מדי ניסיונות, נסה שוב בעוד מספר דקות');
  }
  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, uname));
  const ok = !!user && user.active && (await verifyPassword(password, user.passwordHash));
  await db.insert(schema.loginAttempts).values({ username: uname, ip: ctx?.ip ?? null, ok });
  if (!ok) throw new HttpError(401, BAD);
  const s = await createSession(user.id);
  return json({ user: toPublic(user) }, 200, { 'set-cookie': sessionCookie(s.id, s.expiresAt) });
});

export const config: Config = { path: '/api/auth/login' };
