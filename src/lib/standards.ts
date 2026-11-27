import { api } from './api';

export type Standard = { id: string; name: string; formIds: string[]; size: number; createdAt: string };

export const PART = 3 * 1024 * 1024;
export const STD_MAX = 50 * 1024 * 1024;

export const listStandards = () => api<{ standards: Standard[] }>('/api/standards').then((r) => r.standards);
export const standardPdfUrl = (id: string) => `/api/standards/${id}/pdf`;

/** Uploads in parts: requests are capped near 6MB. */
export async function uploadStandard(file: File, name: string, formIds: string[], onProgress?: (done: number) => void) {
  const id = crypto.randomUUID();
  const parts = Math.ceil(file.size / PART);
  for (let n = 0; n < parts; n++) {
    await api(`/api/standards/${id}/part?n=${n}`, { method: 'PUT', body: file.slice(n * PART, (n + 1) * PART), headers: { 'content-type': 'application/octet-stream' } });
    onProgress?.((n + 1) / parts);
  }
  return api<{ standard: Standard }>('/api/standards', { method: 'POST', json: { id, name, formIds, parts } }).then((r) => r.standard);
}

export const patchStandard = (id: string, b: { name?: string; formIds?: string[] }) =>
  api<{ standard: Standard }>(`/api/standards/${id}`, { method: 'PATCH', json: b }).then((r) => r.standard);
export const deleteStandard = (id: string) => api(`/api/standards/${id}`, { method: 'DELETE' });
