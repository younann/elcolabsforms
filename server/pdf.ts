import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { timingSafeEqual } from 'node:crypto';
import { Report, type ReportProps } from '../shared/pdf/Report';
import { FONT_CSS, PRINT_CSS } from '../shared/pdf/assets.gen';
import type { FormDef } from '../shared/forms/types';

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderReportHtml(props: ReportProps): string {
  const doc = createElement(
    'html',
    { lang: 'he', dir: 'rtl' },
    createElement(
      'head',
      null,
      createElement('meta', { charSet: 'utf-8' }),
      createElement('title', null, props.def.title),
      createElement('style', { dangerouslySetInnerHTML: { __html: `${FONT_CSS}\n${PRINT_CSS}` } }),
    ),
    createElement('body', null, createElement(Report, props)),
  );
  return `<!DOCTYPE html>${renderToStaticMarkup(doc)}`;
}

export function footerTemplate(text: string): string {
  // header/footer templates do not share page fonts, so embed them
  return `<style>${FONT_CSS}</style><div dir="rtl" style="font-family:'Heebo',sans-serif;font-size:7.5pt;color:#555;width:100%;padding:0 11mm;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact"><span>${escHtml(text)}</span><span>עמוד <span class="pageNumber"></span> מתוך <span class="totalPages"></span></span></div>`;
}

export async function htmlToPdf(html: string, opts: { footerText?: string } = {}): Promise<Buffer> {
  const { default: puppeteer } = await import('puppeteer-core');
  const local = process.env.CHROME_PATH;
  let executablePath = local;
  let args: string[] = ['--no-sandbox'];
  if (!local) {
    const { default: chromium } = await import('@sparticuz/chromium');
    executablePath = await chromium.executablePath();
    args = await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' });
  }
  const browser = await puppeteer.launch({ executablePath, args, headless: 'shell' });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(opts.footerText ?? ''),
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function reportSubject(def: FormDef, siteName: string, testNumber: string, revision: number): string {
  const base = `${def.title} – ${siteName} – ${testNumber}`;
  return revision > 0 ? `${base} Rev ${revision} (תיקון)` : base;
}

export const pdfKey = (id: string, revision: number) => `pdf/${id}-r${revision}.pdf`;

// background trigger must send x-internal-key; without INTERNAL_KEY only localhost is allowed
export function internalKeyOk(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const key = env.INTERNAL_KEY;
  if (key) {
    if (!header) return false;
    const a = Buffer.from(header);
    const b = Buffer.from(key);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  return (env.APP_URL ?? '').startsWith('http://localhost');
}
