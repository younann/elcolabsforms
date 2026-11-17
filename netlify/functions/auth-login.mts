import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { and, count, eq, gt } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { createSession, sessionCookie, toPublic, clientIp, loginBlocked, verifyOrDummy, LOGIN_WINDOW_MS } from '../../server/auth';

const Body = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) });
const BAD = 'שם משתמש או סיסמה שגויים';

export default handle(async (req, ctx) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { username, password } = await parseBody(req, Body);
  const uname = username.toLowerCase();
  const ip = clientIp(req, ctx?.ip);
  const db = getDb();
  const A = schema.loginAttempts;

  // record first so parallel attempts see each other
  const [attempt] = await db.insert(A).values({ username: uname, ip, ok: false }).returning({ id: A.id });
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const fails = (where: ReturnType<typeof eq>) =>
    db
      .select({ n: count() })
      .from(A)
      .where(and(where, eq(A.ok, false), gt(A.at, since)))
      .then((r) => r[0]?.n ?? 0);
  const [userFails, ipFails] = await Promise.all([fails(eq(A.username, uname)), ip ? fails(eq(A.ip, ip)) : 0]);
  if (loginBlocked(userFails, ipFails)) {
    // a blocked try does not extend the lockout
    await db.delete(A).where(eq(A.id, attempt.id));
    throw new HttpError(429, 'יותר מדי ניסיונות, נסה שוב בעוד מספר דקות');
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, uname));
  const match = await verifyOrDummy(password, user?.passwordHash);
  const ok = !!user && user.active && match;
  if (!ok) throw new HttpError(401, BAD);
  await db.update(A).set({ ok: true }).where(eq(A.id, attempt.id));
  const s = await createSession(user.id);
  return json({ user: toPublic(user) }, 200, { 'set-cookie': sessionCookie(s.id, s.expiresAt) });
});

export const config: Config = { path: '/api/auth/login' };
