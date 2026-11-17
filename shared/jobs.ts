import type { FormData, FormDef } from './forms/types';
import type { Status } from './status';

export const JOB_QTY_MAX = 9;

export type PrefillCtx = {
  plannedDate: string;
  siteName: string;
  siteAddress: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
};

// fill a new form from job details
export function prefillData(def: FormDef, ctx: PrefillCtx): FormData {
  const ids = new Set(def.sections.flatMap((s) => s.fields.map((f) => f.id)));
  const src: Record<string, string | null | undefined> = {
    date: ctx.plannedDate,
    siteName: ctx.siteName,
    siteAddress: ctx.siteAddress,
    customerName: ctx.clientName,
    customerPhone: ctx.clientPhone,
    customerEmail: ctx.clientEmail,
  };
  const out: FormData = {};
  for (const [id, v] of Object.entries(src)) {
    if (ids.has(id) && typeof v === 'string' && v.trim()) out[id] = v;
  }
  return out;
}

export type JobFormLite = { status: Status };
export type JobState = 'open' | 'done' | 'cancelled' | 'cancelled-open';

export function jobState(forms: JobFormLite[], cancelledAt: string | Date | null): JobState {
  const pending = forms.some((f) => f.status === 'draft' || f.status === 'returned');
  if (cancelledAt) return pending ? 'cancelled-open' : 'cancelled';
  return pending ? 'open' : 'done';
}

export function copyLabel(shortTitle: string, copy: number | null, copiesOfForm: number): string {
  return copy && copiesOfForm > 1 ? `${shortTitle} ${copy}` : shortTitle;
}

// copies continue after the existing count
export function expandQuantities(
  q: Record<string, number>,
  existing: Record<string, number> = {},
): { formId: string; copy: number }[] {
  const out: { formId: string; copy: number }[] = [];
  for (const [formId, n] of Object.entries(q)) {
    const start = existing[formId] ?? 0;
    for (let i = 1; i <= n; i++) out.push({ formId, copy: start + i });
  }
  return out;
}

export function isUntouched(s: { status: Status; touchedAt: Date | string | null }): boolean {
  return s.status === 'draft' && !s.touchedAt;
}
