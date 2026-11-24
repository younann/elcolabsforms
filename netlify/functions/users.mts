import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser, hashPassword } from '../../server/auth';
import { UserCreate as Create, UserPatch as Patch } from '../../shared/users';

const view = (u: typeof schema.users.$inferSelect) => ({
  id: u.id, username: u.username, displayName: u.displayName, role: u.role, active: u.active, createdAt: u.createdAt,
  email: u.email, phone: u.phone,
});

export default handle(async (req, ctx) => {
  const me = await requireUser(req, 'admin');
  const db = getDb();
  const id = ctx.params?.id as string | undefined;
  if (id !== undefined && !z.uuid().safeParse(id).success) throw new HttpError(404, 'משתמש לא נמצא');

  if (!id && req.method === 'GET') {
    // light list for pickers
    if (new URL(req.url).searchParams.get('inspectors') === '1') {
      const list = await db
        .select({ id: schema.users.id, displayName: schema.users.displayName, username: schema.users.username, phone: schema.users.phone })
        .from(schema.users)
        .where(and(eq(schema.users.role, 'inspector'), eq(schema.users.active, true)))
        .orderBy(asc(schema.users.displayName));
      return json({ inspectors: list });
    }
    const rows = await db.select().from(schema.users).orderBy(asc(schema.users.displayName));
    return json({ users: rows.map(view) });
  }
  if (!id && req.method === 'POST') {
    const b = await parseBody(req, Create);
    const exists = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, b.username));
    if (exists.length) throw new HttpError(409, 'שם המשתמש כבר קיים');
    const [u] = await db
      .insert(schema.users)
      .values({ username: b.username, displayName: b.displayName, role: b.role, email: b.email, phone: b.phone, passwordHash: await hashPassword(b.password) })
      .returning();
    return json({ user: view(u) }, 201);
  }
  if (id && req.method === 'PATCH') {
    const b = await parseBody(req, Patch);
    if (id === me.id && (b.active === false || (b.role !== undefined && b.role !== 'admin'))) {
      throw new HttpError(400, 'לא ניתן להשבית או להוריד הרשאה לעצמך');
    }
    const set: Partial<typeof schema.users.$inferInsert> = {};
    if (b.displayName !== undefined) set.displayName = b.displayName;
    if (b.role !== undefined) set.role = b.role;
    if (b.active !== undefined) set.active = b.active;
    if (b.email !== undefined) set.email = b.email;
    if (b.phone !== undefined) set.phone = b.phone;
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
