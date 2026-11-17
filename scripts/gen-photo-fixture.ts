// writes tests/fixtures/photo-4000x3000.jpg for e2e uploads
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
const b64 = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 4000;
  c.height = 3000;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 4000, 3000);
  g.addColorStop(0, '#c2410c');
  g.addColorStop(1, '#1d5592');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4000, 3000);
  // texture so the file has a realistic size
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `hsl(${(i * 37) % 360} 60% ${30 + (i % 50)}%)`;
    ctx.fillRect((i * 7919) % 4000, (i * 104729) % 3000, 40, 40);
  }
  return c.toDataURL('image/jpeg', 0.92).split(',')[1];
});
await browser.close();
writeFileSync('tests/fixtures/photo-4000x3000.jpg', Buffer.from(b64, 'base64'));
console.log('ok');
