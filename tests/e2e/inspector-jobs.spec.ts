import { expect, request, test } from '@playwright/test';
import { ADMIN_PASS, ADMIN_USER, adminContext, createJob, login } from './jobs-helper';

const PASS = 'insp-jobs-e2e-pass';
const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 8888}`;
test.skip(!ADMIN_USER || !ADMIN_PASS, 'seed credentials not set');

async function newInspector() {
  const admin = await adminContext();
  const username = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const u = await admin.post('/api/users', { data: { username, displayName: 'בודק פותח', password: PASS, role: 'inspector' } });
  expect(u.status()).toBe(201);
  const id = (await u.json()).user.id as string;
  await admin.dispose();
  const ctx = await request.newContext({ baseURL: BASE });
  await login(ctx, username, PASS);
  return { id, username, ctx };
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

test('inspector opens work for a new client and manages only their own jobs', async () => {
  test.setTimeout(120_000);
  const me = await newInspector();
  const other = await newInspector();
  const tag = Date.now().toString(36);

  // new client and site, site forms saved
  const client = (await (await me.ctx.post('/api/clients', { data: { name: `לקוח שטח ${tag}`, phone: '0509998888' } })).json()).client;
  const sr = await me.ctx.post(`/api/clients/${client.id}/sites`, { data: { name: `אתר ${tag}`, address: 'הרצל 1, חיפה', formIds: ['gas', 'f536'] } });
  expect(sr.status()).toBe(201);
  const site = (await sr.json()).site;
  expect(site.formIds.sort()).toEqual(['f536', 'gas']);

  // other inspector's id is refused
  // netlify dev retries a POST 403 as static paths, which the job route answers 404
  const refused = await me.ctx.post('/api/jobs', { data: { clientId: client.id, siteId: site.id, inspectorId: other.id, plannedDate: today(), forms: ['gas'] } });
  expect([403, 404]).toContain(refused.status());
  // duplicate forms are refused
  expect((await me.ctx.post('/api/jobs', { data: { clientId: client.id, siteId: site.id, inspectorId: me.id, plannedDate: today(), forms: ['gas', 'gas'] } })).status()).toBe(400);

  const r = await me.ctx.post('/api/jobs', { data: { clientId: client.id, siteId: site.id, inspectorId: me.id, plannedDate: today(), forms: ['gas'] } });
  expect(r.status()).toBe(201);
  const job = (await r.json()).job;
  expect(job.openedByInspector).toBe(true);
  expect(job.canManage).toBe(true);

  // add forms: an existing form is refused, a new one works
  expect((await me.ctx.post(`/api/jobs/${job.id}/forms`, { data: { forms: ['gas'] } })).status()).toBe(409);
  expect((await me.ctx.post(`/api/jobs/${job.id}/forms`, { data: { forms: ['f536'] } })).status()).toBe(201);
  expect((await me.ctx.patch(`/api/jobs/${job.id}`, { data: { note: 'עודכן בשטח' } })).ok()).toBe(true);

  // client list: names only
  const list = (await (await me.ctx.get('/api/clients')).json()).clients as { id: string; phone: string | null; email: string | null }[];
  const mine = list.find((c) => c.id === client.id)!;
  expect(mine.phone).toBeNull();
  const detail = await (await me.ctx.get(`/api/clients/${client.id}`)).json();
  expect(detail.sites[0].address).toBe('');
  expect((await me.ctx.patch(`/api/clients/${client.id}`, { data: { name: 'x' } })).status()).toBe(403);

  // admin-created job stays admin-only
  const adminJob = await createJob(me.id, ['aerosol']);
  expect([403, 404]).toContain((await me.ctx.post(`/api/jobs/${adminJob.jobId}/cancel`)).status());
  expect((await (await adminContext()).get(`/api/jobs/${adminJob.jobId}`).then((r) => r.json())).job.cancelledAt).toBeNull();

  // admin sees the tag
  const admin = await adminContext();
  const seen = (await (await admin.get(`/api/jobs/${job.id}`)).json()).job;
  expect(seen.openedByInspector).toBe(true);
  expect(seen.canManage).toBe(true);
  await admin.dispose();

  // inspector cancels their own job
  const c = await me.ctx.post(`/api/jobs/${job.id}/cancel`);
  expect(c.ok()).toBe(true);
  await me.ctx.dispose();
  await other.ctx.dispose();
});

test('admin required-field choice changes what blocks submit', async () => {
  const me = await newInspector();
  const admin = await adminContext();
  const def = (await import('../../shared/forms')).getForm('aerosol');
  const checks = def.sections.flatMap((s) => s.fields).filter((f) => f.type === 'check').map((f) => f.id);
  // every check optional
  const put = await admin.put('/api/settings/required', { data: { formId: 'aerosol', overrides: Object.fromEntries(checks.map((id) => [id, false])) } });
  expect(put.ok()).toBe(true);
  expect((await admin.put('/api/settings/required', { data: { formId: 'aerosol', overrides: { approverSignature: true } } })).status()).toBe(400);
  try {
    const job = await createJob(me.id, ['aerosol']);
    const r = await me.ctx.post(`/api/submissions/${job.formIds[0]}/action`, { data: { action: 'submit' } });
    const body = await r.json();
    const missing = (body.missing ?? []).map((m: { fieldId: string }) => m.fieldId);
    for (const id of checks) expect(missing).not.toContain(id);
  } finally {
    await admin.put('/api/settings/required', { data: { formId: 'aerosol', overrides: {} } });
    await admin.dispose();
    await me.ctx.dispose();
  }
});
