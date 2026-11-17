import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FireExtinguisher } from '@phosphor-icons/react/dist/ssr';
import sharp from 'sharp';

const BG = '#c2410c';
const FG = '#fffaf7';

// glyph is a fraction of the canvas
async function icon(size: number, glyph: number, rounded: boolean, out: string) {
  const g = Math.round(size * glyph);
  const svg = renderToStaticMarkup(createElement(FireExtinguisher, { size: g, weight: 'fill', color: FG }));
  const r = rounded ? Math.round(size * 0.22) : 0;
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/></svg>`,
  );
  const off = Math.round((size - g) / 2);
  await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: off, left: off }])
    .png()
    .toFile(out);
}

await icon(192, 0.56, true, 'public/icons/icon-192.png');
await icon(512, 0.56, true, 'public/icons/icon-512.png');
// maskable: glyph inside the safe zone, full bleed
await icon(512, 0.46, false, 'public/icons/maskable-512.png');
// iOS rounds the corners itself
await icon(180, 0.56, false, 'public/apple-touch-icon.png');
