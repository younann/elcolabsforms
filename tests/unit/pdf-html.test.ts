import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FORMS, getForm } from '../../shared/forms';
import { formatDate, type ReportProps } from '../../shared/pdf/Report';
import { renderReportHtml, reportSubject, pdfKey, internalKeyOk } from '../../server/pdf';
import { PRINT_CSS } from '../../shared/pdf/assets.gen';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

type Fixture = Omit<ReportProps, 'def' | 'images'> & { formId: string; data: Record<string, unknown> };
const load = (id: string): Fixture => JSON.parse(readFileSync(new URL(`../fixtures/${id}.json`, import.meta.url), 'utf8'));

// matches React's text escaping
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function leaves(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string' || typeof v === 'number') {
    if (String(v).trim()) out.push(String(v));
  } else if (Array.isArray(v)) v.forEach((x) => leaves(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => leaves(x, out));
  return out;
}

describe('renderReportHtml', () => {
  for (const def of FORMS) {
    describe(def.id, () => {
      const fx = load(def.id);
      const images = { inspectorSignature: [PNG], photos: [PNG, PNG, PNG] };
      const html = renderReportHtml({ ...fx, def: getForm(fx.formId), images });

      it('is rtl hebrew', () => {
        expect(html).toMatch(/^<!DOCTYPE html>/i);
        expect(html).toContain('dir="rtl"');
        expect(html).toContain('lang="he"');
      });

      it('has title and doc number', () => {
        expect(html).toContain(esc(def.title));
        if (def.docNumber) expect(html).toContain(def.docNumber);
      });

      it('has every check text', () => {
        const checks = def.sections.flatMap((s) => s.fields).filter((f) => f.type === 'check');
        expect(checks.length).toBeGreaterThan(0);
        for (const c of checks) expect(html, c.id).toContain(esc(c.text));
      });

      it('has the approver name', () => {
        expect(html).toContain(esc(fx.approver.name));
      });

      it('wraps every user-entered value in bdi', () => {
        const dateIds = new Set(def.sections.flatMap((s) => s.fields).filter((f) => f.type === 'date').map((f) => f.id));
        const values = leaves(Object.entries(fx.data).map(([k, v]) => (dateIds.has(k) ? formatDate(String(v)) : v)));
        expect(values.length).toBeGreaterThan(10);
        for (const v of values) expect(html, v).toMatch(new RegExp(`<bdi(?: dir="rtl")?>${reEsc(esc(v))}</bdi>`));
      });

      it('inlines css, font and images', () => {
        expect(html).toContain('@font-face');
        expect(html).toContain('data:font/woff2;base64,');
        expect(html).not.toMatch(/(src|href)="https?:/);
        expect(html.split(PNG).length - 1).toBeGreaterThanOrEqual(4);
      });
    });
  }

  it('marks a revision as a correction', () => {
    const fx = load('f536');
    const html = renderReportHtml({ ...fx, def: getForm('f536'), images: {}, revision: 2 });
    expect(html).toContain('Rev 2');
    expect(html).toContain('תיקון');
  });

  it('shows the mixed hebrew/latin sample', () => {
    const fx = load('aerosol');
    const html = renderReportHtml({ ...fx, def: getForm('aerosol'), images: {} });
    expect(html).toContain('<bdi dir="rtl">גלאי עשן דגם SD-851 כמות 12');
  });

  it('places the stamp and approver signature', () => {
    const fx = load('detectors');
    const html = renderReportHtml({
      ...fx,
      def: getForm('detectors'),
      images: {},
      settings: { ...fx.settings, stamp: 'data:image/png;base64,STAMP' },
      approver: { ...fx.approver, signature: 'data:image/png;base64,APPSIG' },
    });
    expect(html).toContain('data:image/png;base64,STAMP');
    expect(html).toContain('data:image/png;base64,APPSIG');
    expect(html).toContain(formatDate(fx.approver.date));
  });

  it('puts photos two per appendix page', () => {
    const fx = load('gas');
    const html = renderReportHtml({ ...fx, def: getForm('gas'), images: { photos: [PNG, PNG, PNG] } });
    expect(html.match(/class="photo-page"/g)?.length).toBe(2);
  });

  it('keeps generated css in sync with print.css', () => {
    expect(PRINT_CSS).toBe(readFileSync(new URL('../../shared/pdf/print.css', import.meta.url), 'utf8'));
  });
});

describe('report helpers', () => {
  it('builds the subject', () => {
    const def = getForm('aerosol');
    expect(reportSubject(def, 'אתר א', 'T-12', 0)).toBe(`${def.title} – אתר א – T-12`);
    expect(reportSubject(def, 'אתר א', 'T-12', 2)).toBe(`${def.title} – אתר א – T-12 Rev 2 (תיקון)`);
  });

  it('builds the pdf key', () => {
    expect(pdfKey('abc', 1)).toBe('pdf/abc-r1.pdf');
  });

  it('checks the internal key', () => {
    expect(internalKeyOk('k1', { INTERNAL_KEY: 'k1' })).toBe(true);
    expect(internalKeyOk('k2', { INTERNAL_KEY: 'k1' })).toBe(false);
    expect(internalKeyOk(null, { INTERNAL_KEY: 'k1' })).toBe(false);
    expect(internalKeyOk(null, { APP_URL: 'http://localhost:8888' })).toBe(true);
    expect(internalKeyOk(null, { APP_URL: 'https://forms.example.com' })).toBe(false);
    expect(internalKeyOk(null, {})).toBe(false);
  });
});
