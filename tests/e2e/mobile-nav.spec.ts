import { expect, test, type Page } from '@playwright/test';

const ADMIN_USER = process.env.E2E_USERNAME ?? process.env.SEED_ADMIN_USERNAME ?? '';
const ADMIN_PASS = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? '';
const PASS = 'nav-e2e-pass';

test.skip(!ADMIN_USER || !ADMIN_PASS, 'seed credentials not set');

let inspector = '';

test.beforeAll(async ({ playwright, baseURL }) => {
  const admin = await playwright.request.newContext({ baseURL });
  expect((await admin.post('/api/auth/login', { data: { username: ADMIN_USER, password: ADMIN_PASS } })).ok()).toBe(true);
  inspector = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const r = await admin.post('/api/users', { data: { username: inspector, displayName: 'בודק ניווט', password: PASS, role: 'inspector' } });
  expect(r.status()).toBe(201);
  await admin.dispose();
});

const dialogs = (page: Page) => page.locator('dialog[open]');

test('back closes sheets before leaving, header back and logout confirm', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone header and back gesture');
  expect((await page.request.post('/api/auth/login', { data: { username: inspector, password: PASS } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: /ארוסול/ }).first().click();
  await expect(page).toHaveURL(/\/fill\//);
  const fillUrl = page.url();

  // back gesture closes the sheet, page stays
  await page.getByRole('button', { name: /סעיפים/ }).click();
  await expect(dialogs(page)).toHaveCount(1);
  await page.goBack();
  await expect(dialogs(page)).toHaveCount(0);
  expect(page.url()).toBe(fillUrl);

  // header back leaves the form
  await page.getByTestId('header-back').click();
  await expect(page).toHaveURL(/\/$/);

  // logout asks first; back cancels
  await page.getByRole('link', { name: 'פרופיל' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole('button', { name: 'יציאה' }).first().click();
  await expect(dialogs(page)).toHaveCount(1);
  await page.goBack();
  await expect(dialogs(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/profile$/);
});

test('deep-linked form: header back falls back home', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone header');
  expect((await page.request.post('/api/auth/login', { data: { username: inspector, password: PASS } })).ok()).toBe(true);
  const r = await page.request.post('/api/submissions', { data: { formId: 'aerosol' } });
  const { submission } = (await r.json()) as { submission: { id: string } };
  await page.goto(`/fill/${submission.id}`);
  await page.getByTestId('header-back').click();
  await expect(page).toHaveURL(/\/$/);
});
