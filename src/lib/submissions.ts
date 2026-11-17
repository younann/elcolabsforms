import { api } from './api';
import { FORMS } from '../../shared/forms';
import { STUCK_MS, type Status } from '../../shared/status';
import type { Role } from './auth';

export type Summary = {
  id: string;
  formId: string;
  status: Status;
  testNumber: string | null;
  siteName: string | null;
  revision: number;
  parentId: string | null;
  reviewNote: string | null;
  sendError: string | null;
  mailLogged: boolean;
  hasPdf: boolean;
  hasChild: boolean;
  inspectorId: string;
  inspectorName: string;
  submittedAt: string | null;
  emailedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: number;
  userId: string;
  action: string;
  fieldId: string | null;
  oldValue: unknown;
  newValue: unknown;
  note: string | null;
  at: string;
};

export function listSubmissions(q: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const qs = p.toString();
  return api<{ submissions: Summary[] }>(`/api/submissions${qs ? `?${qs}` : ''}`).then((r) => r.submissions);
}

export async function duplicate(id: string) {
  const r = await api<{ submission: { id: string } }>(`/api/submissions/${id}/duplicate`, { method: 'POST' });
  return r.submission.id;
}

export function act(id: string, action: 'return' | 'approve' | 'reopen' | 'retry', note?: string) {
  return api<{ submission: { id: string; status: Status } }>(`/api/submissions/${id}/action`, {
    method: 'POST',
    json: note ? { action, note } : { action },
  });
}

export const pdfUrl = (id: string) => `/api/submissions/${id}/pdf`;

export const formShort = (formId: string) => FORMS.find((f) => f.id === formId)?.shortTitle ?? formId;

// where a row opens for this role
export function rowHref(s: Pick<Summary, 'id' | 'status'>, role: Role) {
  if (role === 'admin' && s.status === 'submitted') return `/admin/review/${s.id}`;
  if (role === 'inspector' && (s.status === 'draft' || s.status === 'returned')) return `/fill/${s.id}`;
  return `/submissions/${s.id}`;
}

export const isStuck = (s: Pick<Summary, 'status' | 'updatedAt'>, now = Date.now()) =>
  s.status === 'sending' && now - new Date(s.updatedAt).getTime() > STUCK_MS;

const dayFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jerusalem' });
const timeFmt = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jerusalem',
});

export const fmtDay = (iso: string | null | undefined) => (iso ? dayFmt.format(new Date(iso)) : '');
export const fmtTime = (iso: string | null | undefined) => (iso ? timeFmt.format(new Date(iso)) : '');

// israel calendar day, yyyy-mm-dd
export const ilDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
