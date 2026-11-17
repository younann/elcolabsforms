import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../server/db/client';

const username = process.env.SEED_ADMIN_USERNAME;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!username || !password) throw new Error('SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD required');

const db = getDb();
await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();
const existing = await db.select().from(schema.users).where(eq(schema.users.username, username));
if (existing.length) {
  console.log('exists');
} else {
  await db.insert(schema.users).values({
    username,
    displayName: username,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'admin',
  });
  console.log('created');
}
