import { expect, request, type APIRequestContext } from '@playwright/test';

export const ADMIN_USER = process.env.E2E_USERNAME ?? process.env.SEED_ADMIN_USERNAME ?? '';
export const ADMIN_PASS = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? '';
// same default as playwright.config
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 8888}`;

// parallel workers' in-flight logins count toward the limit briefly
export async function login(req: APIRequestContext, username: string, password: string) {
  for (let i = 0; ; i++) {
    const r = await req.post('/api/auth/login', { data: { username, password } });
    if (r.status() !== 429 || i === 4) return expect(r.ok()).toBe(true);
    await new Promise((res) => setTimeout(res, 1000 + Math.random() * 1000));
  }
}

export async function adminContext() {
  const admin = await request.newContext({ baseURL: BASE });
  await login(admin, ADMIN_USER, ADMIN_PASS);
  return admin;
}

/** Admin creates a client, site and job; returns the job and its form ids. */
export async function createJob(inspectorId: string, forms: string[] = ['aerosol']) {
  const admin = await adminContext();
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const client = (await (await admin.post('/api/clients', { data: { name: `לקוח בדיקה ${tag}`, contactPerson: 'יוסי', phone: '0501112222' } })).json()).client;
  const site = (await (await admin.post(`/api/clients/${client.id}/sites`, { data: { name: `אתר ${tag}`, address: 'הרצל 12, חיפה' } })).json()).site;
  const r = await admin.post('/api/jobs', { data: { clientId: client.id, siteId: site.id, inspectorId, plannedDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }), forms } });
  expect(r.status()).toBe(201);
  const { job } = (await r.json()) as { job: { id: string; forms: { id: string }[] } };
  await admin.dispose();
  return { jobId: job.id, formIds: job.forms.map((f) => f.id), clientName: client.name as string, siteName: site.name as string };
}
