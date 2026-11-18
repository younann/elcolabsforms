import { expect, test } from '@playwright/test';
import { ADMIN_PASS, ADMIN_USER, adminContext, createJob, login } from './jobs-helper';

const PASS = 'jobs-e2e-pass';
test.skip(!ADMIN_USER || !ADMIN_PASS, 'seed credentials not set');

test('admin job reaches the inspector pre-filled, with a WhatsApp link', async ({ page, browser }) => {
  const admin = await adminContext();
  const username = `jobs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const u = await admin.post('/api/users', { data: { username, displayName: 'בודק עבודות', password: PASS, role: 'inspector', phone: '050-1234567' } });
  expect(u.status()).toBe(201);
  const inspectorId = (await u.json()).user.id as string;
  await admin.dispose();
  const job = await createJob(inspectorId, { aerosol: 1 });

  // inspector: card on home, form pre-filled
  await login(page.request, username, PASS);
  await page.goto('/');
  const card = page.getByTestId('job-card').filter({ hasText: job.clientName });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: /ארוסול/ }).click();
  await expect(page).toHaveURL(new RegExp(`/fill/${job.formIds[0]}$`));
  await expect(page.getByRole('textbox', { name: 'שם המזמין', exact: true })).toHaveValue(job.clientName);
  await expect(page.getByRole('textbox', { name: 'שם האתר', exact: true })).toHaveValue(job.siteName);
  await expect(page.getByTestId('job-context')).toContainText(job.clientName);

  // admin: job page WhatsApp link
  const ctx = await browser.newContext();
  const adminPage = await ctx.newPage();
  await login(adminPage.request, ADMIN_USER, ADMIN_PASS);
  await adminPage.goto(`/jobs/${job.jobId}`);
  await expect(adminPage.getByTestId('whatsapp')).toHaveAttribute('href', /^https:\/\/wa\.me\/972501234567\?text=/);
  await ctx.close();
});
