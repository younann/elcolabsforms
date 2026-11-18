import { api } from './api';
import type { JobSummary, JobView } from '../../shared/jobs';

export type { JobSummary, JobView };
export type Qty = Record<string, number>;
type One = Promise<JobView>;
const one = (p: Promise<{ job: JobView }>): One => p.then((r) => r.job);

export function listJobs(q: { inspectorId?: string; clientId?: string; state?: string } = {}) {
  const p = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => !!e[1]));
  const qs = p.toString();
  return api<{ jobs: JobSummary[] }>(`/api/jobs${qs ? `?${qs}` : ''}`).then((r) => r.jobs);
}
export const getJob = (id: string) => one(api(`/api/jobs/${id}`));
export const createJob = (body: { clientId: string; siteId: string; inspectorId: string; plannedDate: string; note?: string; forms: Qty }) =>
  one(api('/api/jobs', { method: 'POST', json: body }));
export const patchJob = (id: string, body: { plannedDate?: string; note?: string }) => one(api(`/api/jobs/${id}`, { method: 'PATCH', json: body }));
export const addJobForms = (id: string, forms: Qty) => one(api(`/api/jobs/${id}/forms`, { method: 'POST', json: { forms } }));
export const setJobInspector = (id: string, inspectorId: string) => one(api(`/api/jobs/${id}/inspector`, { method: 'POST', json: { inspectorId } }));
export const cancelJob = (id: string) => one(api(`/api/jobs/${id}/cancel`, { method: 'POST' }));

const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jerusalem' });
// planned date is a plain day
export const jobDate = (d: string) => dateFmt.format(new Date(`${d}T12:00:00Z`));
