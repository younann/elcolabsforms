import { expect, test } from '@playwright/test';

const USERNAME = process.env.E2E_USERNAME ?? process.env.SEED_ADMIN_USERNAME ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? '';

test('logged-out visit lands on login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'כניסה' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  // unknown user, so the real account never hits the rate limit
  await page.getByLabel('שם משתמש').fill(`nobody-${Date.now()}`);
  await page.getByLabel('סיסמה', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('alert')).toHaveText('שם משתמש או סיסמה שגויים');
  await expect(page).toHaveURL(/\/login$/);
});

test('correct password lands on home', async ({ page }) => {
  test.skip(!USERNAME || !PASSWORD, 'seed credentials not set');
  await page.goto('/login');
  await page.getByLabel('שם משתמש').fill(USERNAME);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('שלום');

  // session survives reload
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('שלום');

  await page.getByRole('button', { name: 'יציאה' }).click();
  await page.getByTestId('confirm-logout').click();
  await expect(page).toHaveURL(/\/login$/);
});

test('mobile basics: 16px inputs, 44px targets, no sideways scroll', async ({ page }) => {
  await page.goto('/login');
  const input = page.getByLabel('שם משתמש');
  const size = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  const box = await page.getByRole('button', { name: 'כניסה' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const toggle = await page.getByRole('button', { name: 'הצגת סיסמה' }).boundingBox();
  expect(toggle!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
