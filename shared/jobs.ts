import { z } from 'zod';
import { FORMS } from './forms';
import type { FormData, FormDef } from './forms/types';
import type { Status } from './status';

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

// admins manage every job, inspectors the ones they opened
export function canManageJob(me: { id: string; role: string }, job: { createdBy: string }): boolean {
  return me.role === 'admin' || (me.role === 'inspector' && job.createdBy === me.id);
}

export function isUntouched(s: { status: Status; touchedAt: Date | string | null }): boolean {
  return s.status === 'draft' && !s.touchedAt;
}

const formId = z.enum(FORMS.map((f) => f.id) as [string, ...string[]]);
// one copy of each form per job
const forms = z
  .array(formId)
  .min(1, 'יש לבחור לפחות טופס אחד')
  .refine((a) => new Set(a).size === a.length, 'כל טופס פעם אחת בלבד');
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
  openedByInspector: boolean;
  // viewer may edit, add forms, reassign, cancel
  canManage: boolean;
  forms: JobFormView[];
};
// list rows carry the same shape
export type JobSummary = JobView;
