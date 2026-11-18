import { z } from 'zod';
import { FORMS } from './forms';
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

const formId = z.enum(FORMS.map((f) => f.id) as [string, ...string[]]);
const qty = z.partialRecord(formId, z.number().int().min(0).max(JOB_QTY_MAX));
const forms = qty.refine((q) => Object.values(q).some((n) => (n ?? 0) > 0), 'יש לבחור לפחות טופס אחד');
const plannedDate = z.iso.date('תאריך לא תקין');
const note = z.string().trim().max(1000).transform((v) => v || null).optional();

export const JobCreate = z.object({ clientId: z.uuid(), siteId: z.uuid(), inspectorId: z.uuid(), plannedDate, note, forms });
export const JobPatch = z.object({ plannedDate: plannedDate.optional(), note });
export const JobAddForms = z.object({ forms });
export const JobInspector = z.object({ inspectorId: z.uuid() });

export type JobFormView = { id: string; formId: string; jobCopy: number | null; status: Status; inspectorId: string; label: string };
export type JobView = {
  id: string;
  client: { id: string; name: string; contactPerson: string | null; phone: string | null };
  site: { id: string; name: string; address: string };
  inspector: { id: string; displayName: string; phone: string | null };
  plannedDate: string;
  note: string | null;
  cancelledAt: string | null;
  state: JobState;
  forms: JobFormView[];
};
// list rows carry the same shape
export type JobSummary = JobView;
