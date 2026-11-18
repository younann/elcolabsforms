import { and, eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';
import { HttpError } from './http';
import type { Submission, User } from './db/schema';
import type { FormData } from '../shared/forms/types';
import type { Status } from '../shared/status';

export async function loadSubmission(id: string): Promise<Submission> {
  const [s] = await getDb().select().from(schema.submissions).where(eq(schema.submissions.id, id));
  if (!s) throw new HttpError(404, 'הטופס לא נמצא');
  return s;
}

// inspectors see only their own
export function assertAccess(me: User, s: Submission) {
  if (me.role !== 'admin' && s.inspectorId !== me.id) throw new HttpError(403, 'אין הרשאה');
}

export const asData = (v: unknown): FormData => (v && typeof v === 'object' && !Array.isArray(v) ? (v as FormData) : {});

// testNumber/siteName mirror data
export function mirror(data: FormData) {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { testNumber: str(data.testNumber), siteName: str(data.siteName) };
}

export function changedFieldIds(oldData: FormData, newData: FormData): string[] {
  const ids = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  return [...ids].filter((k) => JSON.stringify(oldData[k] ?? null) !== JSON.stringify(newData[k] ?? null));
}

// atomic status change; no row means someone else got there first
export async function transition(
  id: string,
  expected: Status,
  set: Partial<Submission>,
  expectedUpdatedAt?: Date,
): Promise<Submission> {
  const conds = [eq(schema.submissions.id, id), eq(schema.submissions.status, expected)];
  if (expectedUpdatedAt) conds.push(eq(schema.submissions.updatedAt, expectedUpdatedAt));
  const rows = await getDb()
    .update(schema.submissions)
    .set({ ...set, updatedAt: new Date() })
    .where(and(...conds))
    .returning();
  if (!rows[0]) throw new HttpError(409, 'מצב הטופס השתנה, רענן ונסה שוב');
  return rows[0];
}

export async function audit(
  submissionId: string,
  userId: string,
  action: string,
  extra: { fieldId?: string; oldValue?: unknown; newValue?: unknown; note?: string } = {},
) {
  await getDb().insert(schema.auditLog).values({ submissionId, userId, action, ...extra });
}

// best-effort audit; never fails the caller
export async function auditSafe(...args: Parameters<typeof audit>) {
  try {
    await audit(...args);
  } catch (e) {
    console.error('audit failed', e);
  }
}

// background fn answers 202; failure only logged
export async function triggerReport(req: Request, id: string) {
  try {
    const base = process.env.APP_URL || new URL(req.url).origin;
    const r = await fetch(`${base}/.netlify/functions/report-background`, {
      method: 'POST',
      headers: { 'x-internal-key': process.env.INTERNAL_KEY ?? '' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) console.error('report trigger status', r.status);
  } catch (e) {
    console.error('report trigger failed', e);
  }
}
