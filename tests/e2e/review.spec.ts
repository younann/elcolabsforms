import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { getForm } from '../../shared/forms';
import { markSectionNA, validateForSubmit } from '../../shared/forms/validate';
import type { FormData } from '../../shared/forms/types';
import { createJob } from './jobs-helper';

const ADMIN_USER = process.env.E2E_USERNAME ?? process.env.SEED_ADMIN_USERNAME ?? '';
const ADMIN_PASS = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? '';
const INSPECTOR_PASS = 'review-e2e-pass';
// 1x1 png
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test.skip(!ADMIN_USER || !ADMIN_PASS, 'seed credentials not set');
test.setTimeout(180_000);

let inspector = '';
let inspectorId = '';
let site = '';

test.beforeAll(async ({ playwright, baseURL }) => {
  const admin = await playwright.request.newContext({ baseURL });
  await login(admin, ADMIN_USER, ADMIN_PASS);
  inspector = `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const r = await admin.post('/api/users', {
    data: { username: inspector, displayName: 'בודקת סקירה', password: INSPECTOR_PASS, role: 'inspector' },
  });
  expect(r.status()).toBe(201);
  inspectorId = (await r.json()).user.id;
  // approve needs the admin's signature and an engineer to mail
  expect((await admin.put('/api/profile/signature', { multipart: { file: { name: 's.png', mimeType: 'image/png', buffer: PNG } } })).ok()).toBe(true);
  const e = await admin.post('/api/users', {
    data: { username: `${inspector}-eng`, displayName: 'מהנדס סקירה', password: INSPECTOR_PASS, role: 'engineer', email: `${inspector}@example.com` },
  });
  expect(e.status()).toBe(201);
  await admin.dispose();
});

// parallel workers' in-flight logins count toward the limit briefly
async function login(req: APIRequestContext, username: string, password: string) {
  for (let i = 0; ; i++) {
    const r = await req.post('/api/auth/login', { data: { username, password } });
    if (r.status() !== 429 || i === 4) return expect(r.ok()).toBe(true);
    await new Promise((res) => setTimeout(res, 1000 + Math.random() * 1000));
  }
}

// complete aerosol form through the API
async function readySubmission(req: APIRequestContext) {
  const def = getForm('aerosol');
  const id = (await createJob(inspectorId)).formIds[0];
  const created = await (await req.get(`/api/submissions/${id}`)).json();
  let data: FormData = {};
  for (const s of def.sections) {
    data = markSectionNA(def, s.id, data);
    for (const f of s.fields) {
      if ((f.type === 'text' || f.type === 'textarea' || f.type === 'number' || f.type === 'time') && f.required) data[f.id] = f.type === 'time' ? '09:30' : f.type === 'number' ? '1' : 'בדיקה';
      if (f.type === 'date' && f.required) data[f.id] = '2026-11-17';
      if (f.type === 'choice' && f.required) data[f.id] = f.options[0];
    }
  }
  data.siteName = site;
  data.testNumber = `R-${Date.now() % 100000}`;
  const att = await req.post('/api/files', {
    multipart: { submissionId: id, fieldId: 'inspectorSignature', kind: 'signature', file: { name: 's.png', mimeType: 'image/png', buffer: PNG } },
  });
  expect(att.status()).toBe(201);
  const attId = (await att.json()).id;
  expect(validateForSubmit(def, data, [{ id: attId, fieldId: 'inspectorSignature', kind: 'signature' }]).missing).toEqual([]);
  const r = await req.patch(`/api/submissions/${id}`, { data: { data, updatedAt: created.submission.updatedAt } });
  expect(r.ok()).toBe(true);
  return id;
}

async function openRow(page: Page, text: string) {
  await page.goto('/');
  const row = page.getByTestId('submission-row').filter({ hasText: text });
  await expect(row).toBeVisible();
  await row.getByRole('link').click();
}

test('return with note, resubmit, approve, emailed', async ({ page, browser }, info) => {
  site = `אתר סקירה ${info.project.name.replace(/\W+/g, '')} ${Date.now() % 100000}`;

  // inspector, own context with the same device
  const { defaultBrowserType: _ignored, ...device } = info.project.use as Record<string, unknown>;
  const ctx = await browser.newContext(device);
  const insp = await ctx.newPage();
  await login(insp.request, inspector, INSPECTOR_PASS);
  const id = await readySubmission(insp.request);
  expect((await insp.request.post(`/api/submissions/${id}/action`, { data: { action: 'submit' } })).ok()).toBe(true);

  // admin returns with a note
  await login(page.request, ADMIN_USER, ADMIN_PASS);
  await openRow(page, site);
  await expect(page).toHaveURL(new RegExp(`/admin/review/${id}$`));
  await page.getByRole('button', { name: 'החזרה', exact: true }).click();
  const note = 'נא להוסיף את מספר האצווה של המיכל';
  await page.getByLabel('מה צריך לתקן?').fill(note);
  await page.getByRole('button', { name: 'החזרה עם ההערה' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('submission-row').filter({ hasText: site })).toHaveCount(0);

  // inspector sees the note and resubmits
  await insp.goto('/');
  const returned = insp.getByTestId('returned-list');
  await expect(returned.getByTestId('review-note')).toHaveText(note);
  await returned.getByRole('link', { name: site }).click();
  await expect(insp).toHaveURL(new RegExp(`/fill/${id}$`));
  await expect(insp.getByRole('status').filter({ hasText: note })).toBeVisible();
  await insp.getByRole('button', { name: 'שליחה לאישור' }).click();
  await expect(insp.getByText('ממתין לאישור').first()).toBeVisible();

  // admin approves; buttons stay disabled while the request is pending
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(`**/api/submissions/${id}/action`, async (route) => {
    await gate;
    await route.continue();
  });
  await openRow(page, site);
  await page.getByRole('button', { name: 'אישור', exact: true }).click();
  // approve happens on the certificate screen
  await expect(page).toHaveURL(new RegExp(`/admin/certificate/${id}$`));
  await page.getByLabel('שליחה ללקוח (דוא״ל)').fill('client@example.com');
  const confirm = page.getByTestId('issue-cert');
  await expect(confirm).toHaveText('אישור ושליחה למהנדס');
  await confirm.click();
  await expect(confirm).toBeDisabled();
  release();
  await expect(page).toHaveURL(new RegExp(`/submissions/${id}$`));
  await page.unroute(`**/api/submissions/${id}/action`);

  // background report reaches emailed
  await expect
    .poll(async () => (await (await page.request.get(`/api/submissions/${id}`)).json()).submission.status, { timeout: 150_000, intervals: [2000] })
    .toBe('engineer_review');
  await expect(page.getByText('ממתין לאישור המהנדס')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('pdf-link')).toBeVisible();
  // the saved certificate draft renders
  const draft = await page.request.get(`/api/submissions/${id}/certificate/preview`);
  expect(draft.status()).toBe(200);
  expect(await draft.text()).toContain('אישור המשרד');

  // one approve only
  const audit = (await (await page.request.get(`/api/submissions/${id}`)).json()).audit as { action: string }[];
  expect(audit.filter((a) => a.action === 'approve')).toHaveLength(1);

  // inspector can download the emailed pdf
  const pdf = await insp.request.get(`/api/submissions/${id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  await ctx.close();
});

test('parallel approve: one wins, one audit row, one report', async ({ playwright, baseURL }, info) => {
  site = `אתר מקביל ${info.project.name.replace(/\W+/g, '')} ${Date.now() % 100000}`;
  const insp = await playwright.request.newContext({ baseURL });
  await login(insp, inspector, INSPECTOR_PASS);
  const id = await readySubmission(insp);
  expect((await insp.post(`/api/submissions/${id}/action`, { data: { action: 'submit' } })).ok()).toBe(true);

  const admin = await playwright.request.newContext({ baseURL });
  await login(admin, ADMIN_USER, ADMIN_PASS);
  const ci = await (await admin.get(`/api/submissions/${id}/certificate`)).json();
  const certificate = { number: ci.suggestedNumber, issueDate: ci.issueDate, data: ci.prefill, sentTo: 'client@example.com' };
  const results = await Promise.all([0, 1].map(() => admin.post(`/api/submissions/${id}/action`, { data: { action: 'approve', certificate } })));
  expect(results.map((r) => r.status()).sort()).toEqual([200, 409]);

  const read = async () => (await (await admin.get(`/api/submissions/${id}`)).json()) as {
    submission: { status: string; emailedAt: string | null };
    audit: { action: string }[];
  };
  await expect.poll(async () => (await read()).submission.status, { timeout: 150_000, intervals: [2000] }).toBe('engineer_review');
  const first = await read();
  expect(first.audit.filter((a) => a.action === 'approve')).toHaveLength(1);
  // no second report run lands later
  await new Promise((r) => setTimeout(r, 5000));
  const later = await read();
  expect(later.submission.emailedAt).toBe(first.submission.emailedAt);
  expect(later.audit.filter((a) => a.action === 'approve')).toHaveLength(1);
  await insp.dispose();
  await admin.dispose();
});
