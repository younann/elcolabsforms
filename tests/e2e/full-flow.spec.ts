import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { getForm } from '../../shared/forms';
import { markSectionNA, markSectionOKCount, validateForSubmit } from '../../shared/forms/validate';
import type { FormData, FormDef } from '../../shared/forms/types';
import { ADMIN_PASS, ADMIN_USER, adminContext, createJob, login } from './jobs-helper';

const PASS = 'full-flow-e2e-pass';
const OUT = 'out/full-flow';
// 1x1 png
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const ALL_FORMS = ['f1220', 'f536', 'detectors', 'aerosol', 'gas'];

test.skip(!ADMIN_USER || !ADMIN_PASS, 'seed credentials not set');
test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'desktop only, one run is enough');
test.use({ video: 'on' });
test.setTimeout(15 * 60_000);

// every check passes, everything else the form requires is filled
function completeData(def: FormDef): FormData {
  let data: FormData = {};
  for (const s of def.sections) {
    data = markSectionNA(def, s.id, markSectionOKCount(def, s.id, data).data);
    for (const f of s.fields) {
      if ((f.type === 'text' || f.type === 'textarea' || f.type === 'number' || f.type === 'time') && f.required) data[f.id] = f.type === 'time' ? '09:30' : f.type === 'number' ? '1' : 'בדיקה';
      if (f.type === 'date' && f.required) data[f.id] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      if (f.type === 'choice' && f.required) data[f.id] = f.options[0];
      if (f.type === 'repeatTable' && f.minRows)
        data[f.id] = Array.from({ length: f.minRows }, () => Object.fromEntries(f.columns.map((c) => [c.id, c.type === 'number' ? '1' : (c.options?.[0] ?? 'בדיקה')])));
    }
  }
  return data;
}

const status = async (req: APIRequestContext, id: string) => (await (await req.get(`/api/submissions/${id}`)).json()).submission.status as string;
const waitStatus = (req: APIRequestContext, id: string, want: string) =>
  expect.poll(() => status(req, id), { timeout: 180_000, intervals: [2000] }).toBe(want);

async function savePdf(req: APIRequestContext, url: string, file: string) {
  const r = await req.get(url);
  expect(r.status()).toBe(200);
  const body = await r.body();
  expect(body.subarray(0, 4).toString()).toBe('%PDF');
  writeFileSync(`${OUT}/${file}`, body);
}

test('job → inspector fills → admin approves with certificate → engineer signs → admin sends', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const tag = `${Date.now() % 1e8}-${Math.random().toString(36).slice(2, 6)}`;

  // users: inspector, engineer with email and saved signature
  const admin = await adminContext();
  const mk = async (role: string, extra: Record<string, string> = {}) => {
    const r = await admin.post('/api/users', { data: { username: `flow-${role}-${tag}`, displayName: role === 'engineer' ? 'מהנדס בדיקה' : 'בודק זרימה', password: PASS, role, ...extra } });
    expect(r.status()).toBe(201);
    return (await r.json()).user as { id: string; username: string };
  };
  const inspector = await mk('inspector');
  const engineer = await mk('engineer', { email: `engineer-${tag}@example.com` });
  await admin.dispose();

  const ctxFor = async (username: string, password: string) => {
    const ctx = await browser.newContext({ locale: 'he-IL', recordVideo: { dir: `${OUT}/video` } });
    const page = await ctx.newPage();
    await login(page.request, username, password);
    return { ctx, page };
  };
  const insp = await ctxFor(inspector.username, PASS);
  const eng = await ctxFor(engineer.username, PASS);
  const adm = await ctxFor(ADMIN_USER, ADMIN_PASS);
  for (const c of [eng, adm]) expect((await c.page.request.put('/api/profile/signature', { multipart: { file: { name: 's.png', mimeType: 'image/png', buffer: PNG } } })).ok()).toBe(true);

  // admin creates a job with all five forms
  const job = await createJob(inspector.id, ALL_FORMS);
  expect(job.formIds).toHaveLength(5);
  const forms: { id: string; formId: string }[] = [];
  for (const id of job.formIds) forms.push({ id, formId: (await (await insp.page.request.get(`/api/submissions/${id}`)).json()).submission.formId });

  // inspector: fills each form, signs, submits from the form page
  for (const f of forms) {
    const def = getForm(f.formId);
    const created = (await (await insp.page.request.get(`/api/submissions/${f.id}`)).json()).submission;
    const data = { ...created.data, ...completeData(def), testNumber: `FF-${tag}-${f.formId}` };
    const att = await insp.page.request.post('/api/files', {
      multipart: { submissionId: f.id, fieldId: 'inspectorSignature', kind: 'signature', file: { name: 's.png', mimeType: 'image/png', buffer: PNG } },
    });
    expect(att.status()).toBe(201);
    expect(validateForSubmit(def, data, [{ id: (await att.json()).id, fieldId: 'inspectorSignature', kind: 'signature' }]).missing).toEqual([]);
    expect((await insp.page.request.patch(`/api/submissions/${f.id}`, { data: { data, updatedAt: created.updatedAt } })).ok()).toBe(true);

    await insp.page.goto(`/fill/${f.id}`);
    await insp.page.getByRole('button', { name: 'שליחה לאישור' }).click();
    await expect(insp.page.getByText('ממתין לאישור').first()).toBeVisible();
  }

  // admin approves each with its certificate; report and draft go to the engineer
  for (const f of forms) {
    await adm.page.goto(`/admin/review/${f.id}`);
    await adm.page.getByRole('button', { name: 'אישור', exact: true }).click();
    await expect(adm.page).toHaveURL(new RegExp(`/admin/certificate/${f.id}$`));
    await adm.page.getByLabel('שליחה ללקוח (דוא״ל)').fill(`client-${tag}@example.com`);
    await adm.page.getByTestId('issue-cert').click();
    await expect(adm.page).toHaveURL(new RegExp(`/submissions/${f.id}$`));
  }
  for (const f of forms) await waitStatus(adm.page.request, f.id, 'engineer_review');

  // engineer checks the certificate draft, approves and signs
  for (const f of forms) {
    await eng.page.goto(`/submissions/${f.id}`);
    await expect(eng.page.getByTestId('cert-preview')).toBeVisible();
    expect((await eng.page.request.get(`/api/submissions/${f.id}/certificate/preview`)).status()).toBe(200);
    await eng.page.getByRole('button', { name: 'אישור', exact: true }).click();
    await eng.page.getByTestId('confirm-engineer-approve').click();
    await expect(eng.page.getByText('הטופס אושר והמשרד עודכן')).toBeVisible();
    await waitStatus(eng.page.request, f.id, 'engineer_approved');
  }

  // admin sends each signed certificate, details kept from approve
  for (const f of forms) {
    await adm.page.goto(`/submissions/${f.id}`);
    await adm.page.getByTestId('issue-link').click();
    await expect(adm.page).toHaveURL(new RegExp(`/admin/certificate/${f.id}$`));
    await expect(adm.page.getByLabel('שליחה ללקוח (דוא״ל)')).toHaveValue(`client-${tag}@example.com`);
    await adm.page.getByTestId('issue-cert').click();
    await expect(adm.page).toHaveURL(new RegExp(`/submissions/${f.id}$`));
  }

  // reports and certificates as pdfs
  for (const f of forms) {
    await waitStatus(adm.page.request, f.id, 'certified');
    await savePdf(adm.page.request, `/api/submissions/${f.id}/pdf`, `${f.formId}-report.pdf`);
    await savePdf(adm.page.request, `/api/submissions/${f.id}/certificate/pdf`, `${f.formId}-certificate.pdf`);
    await adm.page.goto(`/submissions/${f.id}`);
    await expect(adm.page.getByTestId('cert-link')).toBeVisible();
  }

  for (const c of [insp, eng, adm]) await c.ctx.close();
});
