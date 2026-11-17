import { and, eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';
import { HttpError } from './http';
import type { Submission, User } from './db/schema';
import type { FormData, FormDef } from '../shared/forms/types';
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

// drop testNumber, date, signatures, photos, drawings
export function duplicateData(def: FormDef, data: FormData): FormData {
  const drop = new Set(['testNumber', 'date']);
  for (const s of def.sections) {
    for (const f of s.fields) {
      if (f.type === 'signature' || f.type === 'photos' || f.type === 'drawing') drop.add(f.id);
    }
  }
  return Object.fromEntries(Object.entries(data).filter(([k]) => !drop.has(k)));
}

// atomic status change; no row means someone else got there first
export async function transition(id: string, expected: Status, set: Partial<Submission>): Promise<Submission> {
  const rows = await getDb()
    .update(schema.submissions)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(schema.submissions.id, id), eq(schema.submissions.status, expected)))
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

// fire-and-forget; never fails the caller
export function triggerReport(req: Request, id: string) {
  const base = process.env.APP_URL || new URL(req.url).origin;
  fetch(`${base}/.netlify/functions/report-background`, { method: 'POST', body: JSON.stringify({ id }) }).catch((e) =>
    console.error('report trigger failed', e),
  );
}
