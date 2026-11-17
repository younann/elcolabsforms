import type { Status } from './status';

export type ReassignTarget = { id: string; role: 'admin' | 'inspector'; active: boolean } | null;
export type ReassignResult = { ok: true } | { ok: false; status: number; error: string };

export const REASSIGNABLE: readonly Status[] = ['draft', 'returned', 'submitted'];

/** Whether a form may move to another inspector. */
export function reassignCheck({ status, fromId, target }: { status: Status; fromId: string; target: ReassignTarget }): ReassignResult {
  if (!REASSIGNABLE.includes(status)) return { ok: false, status: 409, error: 'לא ניתן לשייך טופס שכבר נשלח' };
  if (!target || !target.active || target.role !== 'inspector') return { ok: false, status: 400, error: 'הבודק לא נמצא או אינו פעיל' };
  if (target.id === fromId) return { ok: false, status: 400, error: 'הטופס כבר משויך לבודק הזה' };
  return { ok: true };
}
