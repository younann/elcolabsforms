import { eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';

export async function loadSettings() {
  const db = getDb();
  const [s] = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
  if (s) return s;
  const [created] = await db.insert(schema.settings).values({ id: 1 }).returning();
  return created;
}
