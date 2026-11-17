// renders out/<form>.docx from tests/fixtures with sample images
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { FORMS } from '../shared/forms';
import { renderReportDocx, type DocxImage, type DocxInput } from '../server/docx';

const svg = (w: number, h: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
const png = async (s: Buffer): Promise<DocxImage> => ({ contentType: 'image/png', data: await sharp(s).png().toBuffer() });
const jpg = async (s: Buffer): Promise<DocxImage> => ({ contentType: 'image/jpeg', data: await sharp(s).jpeg({ quality: 80 }).toBuffer() });

const signature = (seed: number) =>
  png(svg(300, 100, `<path d="M10 70 C 40 ${10 + seed * 7}, 70 95, 100 50 S 160 ${20 + seed * 5}, 190 60 S 250 90, 290 30" fill="none" stroke="#1d3c8f" stroke-width="3"/>`));
const drawing = png(
  svg(
    600,
    360,
    `<rect x="20" y="20" width="560" height="320" fill="#fff" stroke="#333" stroke-width="3"/><rect x="60" y="60" width="160" height="90" fill="none" stroke="#b3261e" stroke-width="2"/><circle cx="420" cy="200" r="40" fill="none" stroke="#1d3c8f" stroke-width="2"/><text x="300" y="320" font-size="22" text-anchor="middle" font-family="sans-serif">Sketch A-1</text>`,
  ),
);
const photo = (n: number) =>
  jpg(
    svg(
      1600,
      1200,
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fb3d9"/><stop offset="1" stop-color="#2d4f73"/></linearGradient></defs><rect width="1600" height="1200" fill="url(#g)"/><text x="800" y="640" font-size="120" fill="#fff" text-anchor="middle" font-family="sans-serif">PHOTO ${n}</text>`,
    ),
  );
const stamp = png(
  svg(
    300,
    300,
    `<circle cx="150" cy="150" r="130" fill="none" stroke="#1d3c8f" stroke-width="8"/><circle cx="150" cy="150" r="100" fill="none" stroke="#1d3c8f" stroke-width="3"/><text x="150" y="165" font-size="40" fill="#1d3c8f" text-anchor="middle" font-family="sans-serif">ELCO LABS</text>`,
  ),
);

mkdirSync('out', { recursive: true });
for (const def of FORMS) {
  const fx = JSON.parse(readFileSync(`tests/fixtures/${def.id}.json`, 'utf8'));
  const images: DocxInput['images'] = { inspectorSignature: [await signature(1)], photos: [await photo(1), await photo(2), await photo(3)] };
  for (const s of def.sections)
    for (const f of s.fields) {
      if (f.type === 'drawing') images[f.id] = [await drawing];
      if (f.type === 'contactAck') images[f.id] = [await signature(3)];
    }
  const t0 = Date.now();
  const out = await renderReportDocx({
    ...fx,
    def,
    images,
    settings: { ...fx.settings, stamp: await stamp },
    approver: { ...fx.approver, signature: await signature(5) },
  });
  writeFileSync(`out/${def.id}.docx`, out);
  console.log(`out/${def.id}.docx ${(out.length / 1024).toFixed(0)}KB ${Date.now() - t0}ms`);
}
