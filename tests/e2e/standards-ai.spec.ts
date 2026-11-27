import { expect, test } from '@playwright/test';
import { ADMIN_PASS, ADMIN_USER, adminContext, createJob, login } from './jobs-helper';

const PASS = 'standards-e2e-pass';
test.skip(!ADMIN_USER || !ADMIN_PASS, 'seed credentials not set');
test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'desktop only');
test.setTimeout(120_000);

test('admin uploads a standard in parts; inspectors read it but cannot manage; chat answers or explains', async ({ page, browser }) => {
  const tag = `${Date.now() % 1e8}`;
  const admin = await adminContext();
  const u = await admin.post('/api/users', { data: { username: `std-${tag}`, displayName: 'בודק תקן', password: PASS, role: 'inspector' } });
  expect(u.status()).toBe(201);
  const inspectorId = (await u.json()).user.id as string;
  await admin.dispose();

  // 7MB pdf: three parts
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(7 * 1024 * 1024, 32)]);
  const name = `תקן בדיקה ${tag}`;
  await login(page.request, ADMIN_USER, ADMIN_PASS);
  await page.goto('/admin/settings');
  await page.getByTestId('standard-input').setInputFiles({ name: 'std.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel('שם התקן').fill(name);
  await page.getByRole('dialog').getByText('גז', { exact: false }).first().click();
  await page.getByTestId('standard-save').click();
  await expect(page.getByTestId('standards').getByText(name)).toBeVisible({ timeout: 60_000 });

  const list = (await (await page.request.get('/api/standards')).json()).standards as { id: string; name: string; size: number; formIds: string[] }[];
  const std = list.find((s) => s.name === name)!;
  expect(std.size).toBe(pdf.length);
  expect(std.formIds.length).toBe(1);

  // inspector: may open the pdf, may not list or delete
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const insp = await ctx.newPage();
  await login(insp.request, `std-${tag}`, PASS);
  const got = await insp.request.get(`/api/standards/${std.id}/pdf`);
  expect(got.status()).toBe(200);
  expect((await got.body()).subarray(0, 5).toString()).toBe('%PDF-');
  expect((await insp.request.get('/api/standards')).status()).toBe(403);
  expect((await insp.request.delete(`/api/standards/${std.id}`)).status()).toBe(403);

  // not a pdf is refused
  const bad = crypto.randomUUID();
  expect((await page.request.put(`/api/standards/${bad}/part?n=0`, { data: Buffer.from('hello'), headers: { 'content-type': 'application/octet-stream' } })).ok()).toBe(true);
  expect((await page.request.post('/api/standards', { data: { id: bad, name: 'x', formIds: [], parts: 1 } })).status()).toBe(400);

  // chat: answers when a key is set, otherwise says it is not set up
  const job = await createJob(inspectorId, ['gas']);
  await insp.goto(`/fill/${job.formIds[0]}`);
  await insp.getByTestId('ai-open').click();
  await insp.getByLabel('השאלה').fill('מה בודקים בבדיקת אטימות החלל?');
  await insp.getByTestId('ai-send').click();
  const chat = insp.getByTestId('ai-chat');
  await expect(chat.getByText('מה בודקים בבדיקת אטימות החלל?')).toBeVisible();
  await expect(chat.locator('div.self-end').last()).not.toHaveText('חושב…', { timeout: 90_000 });
  if (!process.env.GEMINI_API_KEY) await expect(chat.getByText('עוזר ה-AI עדיין לא הוגדר')).toBeVisible();
  await ctx.close();

  // admin deletes it
  expect((await page.request.delete(`/api/standards/${std.id}`)).ok()).toBe(true);
  expect((await page.request.get(`/api/standards/${std.id}/pdf`)).status()).toBe(404);
});
