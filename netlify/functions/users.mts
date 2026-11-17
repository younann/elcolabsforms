import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser, hashPassword } from '../../server/auth';

const Create = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, 'שם משתמש: אותיות לועזיות, ספרות, נקודה או מקף'),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(6).max(200),
  role: z.enum(['admin', 'inspector']),
});
const Patch = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  role: z.enum(['admin', 'inspector']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).max(200).optional(),
});

const view = (u: typeof schema.users.$inferSelect) => ({
  id: u.id, username: u.username, displayName: u.displayName, role: u.role, active: u.active, createdAt: u.createdAt,
});

export default handle(async (req, ctx) => {
  const me = await requireUser(req, 'admin');
  const db = getDb();
  const id = ctx.params?.id as string | undefined;

  if (!id && req.method === 'GET') {
    const rows = await db.select().from(schema.users).orderBy(asc(schema.users.displayName));
    return json({ users: rows.map(view) });
  }
  if (!id && req.method === 'POST') {
    const b = await parseBody(req, Create);
    const exists = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, b.username));
    if (exists.length) throw new HttpError(409, 'שם המשתמש כבר קיים');
    const [u] = await db
      .insert(schema.users)
      .values({ username: b.username, displayName: b.displayName, role: b.role, passwordHash: await hashPassword(b.password) })
      .returning();
    return json({ user: view(u) }, 201);
  }
  if (id && req.method === 'PATCH') {
    const b = await parseBody(req, Patch);
    if (id === me.id && (b.active === false || b.role === 'inspector')) {
      throw new HttpError(400, 'לא ניתן להשבית או להוריד הרשאה לעצמך');
    }
    const set: Partial<typeof schema.users.$inferInsert> = {};
    if (b.displayName !== undefined) set.displayName = b.displayName;
    if (b.role !== undefined) set.role = b.role;
    if (b.active !== undefined) set.active = b.active;
    if (b.password !== undefined) set.passwordHash = await hashPassword(b.password);
    const [u] = await db.update(schema.users).set(set).where(eq(schema.users.id, id)).returning();
    if (!u) throw new HttpError(404, 'משתמש לא נמצא');
    if (b.active === false || b.password !== undefined) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    }
    return json({ user: view(u) });
  }
  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = { path: ['/api/users', '/api/users/:id'] };
