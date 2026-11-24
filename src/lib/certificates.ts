import { api } from './api';
import type { CertData, CertLayout } from '../../shared/certificates';
import type { Status } from '../../shared/status';

export type { CertData };
export type CertInfo = {
  certificate: { number: string | null; status: string; sentTo: string; sentAt: string | null; error: string | null; mailLogged: boolean } | null;
  template: { prefix: string; title: string; layout: CertLayout } | null;
  prefill: CertData | null;
  suggestedNumber: string | null;
  issueDate: string;
  recipient: string;
};

const base = (id: string) => `/api/submissions/${id}/certificate`;
export const getCertInfo = (id: string) => api<CertInfo>(base(id));
export const issueCertificate = (id: string, body: { withoutTemplate: false; number: string; issueDate: string; data: CertData; sentTo: string } | { withoutTemplate: true; sentTo: string }) =>
  api<{ submission: { id: string; status: Status } }>(base(id), { method: 'POST', json: body });
export const retryCertificate = (id: string) => api<{ submission: { id: string; status: Status } }>(`${base(id)}/retry`, { method: 'POST' });

/** Opens the certificate html in a new tab for a look before issuing. */
export async function previewCertificate(id: string, body: { number: string; issueDate: string; data: CertData }) {
  const win = window.open('', '_blank');
  const r = await fetch(`${base(id)}/preview`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) {
    win?.close();
    const e = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? 'התצוגה המקדימה נכשלה');
  }
  const url = URL.createObjectURL(new Blob([await r.text()], { type: 'text/html' }));
  if (win) win.location.href = url;
  else window.location.href = url;
}
