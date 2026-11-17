import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { getDb, schema } from './db/client';
import { HttpError } from './http';
import type { User } from './db/schema';

export * from './auth-core';

const SESSION_DAYS = 30;
const DAY = 86_400_000;
const isDev = () => (process.env.APP_URL ?? '').startsWith('http://localhost');

export type PublicUser = Pick<User, 'id' | 'username' | 'displayName' | 'role'> & { hasSignature: boolean };
export const toPublic = (u: User): PublicUser => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  hasSignature: !!u.signatureKey,
});

export async function createSession(userId: string) {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await getDb().insert(schema.sessions).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export function sessionCookie(id: string, expiresAt: Date) {
  const secure = isDev() ? '' : ' Secure;';
  return `sid=${id}; Path=/; HttpOnly;${secure} SameSite=Lax; Expires=${expiresAt.toUTCString()}`;
}

export const clearCookie = () => `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function readSid(req: Request): string | null {
  const m = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(req.headers.get('cookie') ?? '');
  return m ? m[1] : null;
}

export async function requireUser(req: Request, role?: 'admin'): Promise<User> {
  const sid = readSid(req);
  if (!sid) throw new HttpError(401, 'נדרשת התחברות');
  const db = getDb();
  const rows = await db
    .select({ user: schema.users, expiresAt: schema.sessions.expiresAt })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sid), gt(schema.sessions.expiresAt, new Date())));
  const row = rows[0];
  if (!row || !row.user.active) throw new HttpError(401, 'נדרשת התחברות');
  if (row.expiresAt.getTime() - Date.now() < 15 * DAY) {
    await db
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) })
      .where(eq(schema.sessions.id, sid));
  }
  if (role && row.user.role !== role) throw new HttpError(403, 'אין הרשאה');
  return row.user;
}
