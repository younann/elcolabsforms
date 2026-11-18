import { api } from './api';
import type { ClientRow, SiteRow } from '../../shared/clients';
import type { JobSummary } from '../../shared/jobs';

export type { ClientRow, SiteRow };
export type Client = Omit<ClientRow, 'siteCount'>;
export type ClientInputBody = { name?: string; contactPerson?: string; phone?: string; email?: string; active?: boolean };
export type SiteInputBody = { name?: string; address?: string; active?: boolean };

export const listClients = (q?: string) =>
  api<{ clients: ClientRow[] }>(`/api/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => r.clients);

export const getClient = (id: string) => api<{ client: Client; sites: SiteRow[]; jobs: JobSummary[] }>(`/api/clients/${id}`);

export const saveClient = (input: ClientInputBody, id?: string) =>
  api<{ client: Client }>(id ? `/api/clients/${id}` : '/api/clients', { method: id ? 'PATCH' : 'POST', json: input }).then((r) => r.client);

export const saveSite = (clientId: string, input: SiteInputBody, siteId?: string) =>
  api<{ site: SiteRow }>(`/api/clients/${clientId}/sites${siteId ? `/${siteId}` : ''}`, { method: siteId ? 'PATCH' : 'POST', json: input }).then(
    (r) => r.site,
  );
