import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const ADMIN_USER = process.env.E2E_USERNAME ?? process.env.SEED_ADMIN_USERNAME ?? '';
const ADMIN_PASS = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? '';
const PHOTO = path.resolve('tests/fixtures/photo-4000x3000.jpg');
const INSPECTOR_PASS = 'fill-e2e-pass';

test.skip(!ADMIN_USER || !ADMIN_PASS, 'seed credentials not set');

let inspector = '';

test.beforeAll(async ({ playwright, baseURL }) => {
  const admin = await playwright.request.newContext({ baseURL });
  const login = await admin.post('/api/auth/login', { data: { username: ADMIN_USER, password: ADMIN_PASS } });
  expect(login.ok()).toBe(true);
  inspector = `fill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const r = await admin.post('/api/users', {
    data: { username: inspector, displayName: 'בודק בדיקות', password: INSPECTOR_PASS, role: 'inspector' },
  });
  expect(r.status()).toBe(201);
  await admin.dispose();
});

// label text carries a hidden required mark
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

async function signIn(page: Page) {
  const r = await page.request.post('/api/auth/login', { data: { username: inspector, password: INSPECTOR_PASS } });
  expect(r.ok()).toBe(true);
}

async function newAerosol(page: Page) {
  await page.goto('/new');
  await page.getByRole('button', { name: /כיבוי אש בארוסול/ }).click();
  await expect(page).toHaveURL(/\/fill\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ארוסול');
  return page.url().split('/').pop()!;
}

async function draw(page: Page, testId: string) {
  const canvas = page.locator('dialog[open]').getByTestId(testId);
  await expect(canvas).toBeVisible();
  // let the sheet finish opening
  await page.waitForTimeout(500);
  const box = (await canvas.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.05), y + Math.sin(i) * 20);
  await page.mouse.up();
}

test('fill, sign, photo and submit an aerosol form', async ({ page }) => {
  await signIn(page);
  const id = await newAerosol(page);

  await field(page, 'תאריך הבדיקה').fill('2026-11-17');
  await field(page, "מס' בדיקה").fill('A-1042');
  await field(page, 'שם האתר').fill('מגדל הים 7');

  // reload mid-fill keeps values
  await page.reload();
  await expect(field(page, 'שם האתר')).toHaveValue('מגדל הים 7');
  await expect(field(page, "מס' בדיקה")).toHaveValue('A-1042');

  await field(page, 'כתובת האתר').fill('רחוב הנמל 12, חיפה');
  await field(page, 'שם המזמין').fill('ניהול נכסים בע"מ');

  // mark every check section NA
  const na = page.getByRole('button', { name: 'סמן את השאר כ-ב"י' });
  while ((await na.count()) > 0) await na.first().click();
  await expect(page.locator('#section-results')).toContainText('23/23');

  // inspector signature
  await page.locator('#field-inspectorSignature').getByRole('button', { name: 'הוספת חתימה' }).click();
  await draw(page, 'signature-canvas');
  await page.getByRole('button', { name: 'שמירת חתימה' }).click();
  await expect(page.getByRole('img', { name: /חתימה: שם בודק/ })).toBeVisible();

  // 4000x3000 photo, stored at most 1600px
  await page.getByTestId('photos-input').setInputFiles(PHOTO);
  const thumb = page.getByRole('list', { name: 'תמונות שצורפו' }).locator('img');
  await expect(thumb).toHaveCount(1, { timeout: 20_000 });
  const size = await thumb.first().evaluate(async (img: HTMLImageElement) => {
    const blob = await (await fetch(img.src)).blob();
    const b = await createImageBitmap(blob);
    return { w: b.width, h: b.height, type: blob.type };
  });
  expect(Math.max(size.w, size.h)).toBeLessThanOrEqual(1600);
  expect(size).toMatchObject({ w: 1600, h: 1200, type: 'image/jpeg' });

  await page.getByRole('button', { name: 'שליחה לאישור' }).click();
  await expect(page.getByText('ממתין לאישור').first()).toBeVisible();
  const r = await page.request.get(`/api/submissions/${id}`);
  expect((await r.json()).submission.status).toBe('submitted');
});

test('missing items list jumps to the field', async ({ page }) => {
  await signIn(page);
  await newAerosol(page);
  await field(page, 'שם האתר').fill('אתר חלקי');
  await page.getByRole('button', { name: 'שליחה לאישור' }).click();
  const list = page.getByTestId('missing-list');
  await expect(list).toBeVisible();
  await expect(list).toContainText('שם המזמין');
  await expect(list).not.toContainText('שם האתר');
  await list.getByRole('button', { name: 'שם המזמין' }).click();
  await expect(field(page, 'שם המזמין')).toBeFocused();
  await expect(field(page, 'שם המזמין')).toBeInViewport();
});

test('mobile basics on the fill screen', async ({ page }) => {
  await signIn(page);
  await newAerosol(page);
  const size = await field(page, 'שם האתר').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  for (const r of await page.getByRole('radio').all().then((a) => a.slice(0, 6))) {
    expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
