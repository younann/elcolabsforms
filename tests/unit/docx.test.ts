import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { FORMS, getForm } from '../../shared/forms';
import type { CheckField, CheckValue, FormData } from '../../shared/forms/types';
import { formatDate } from '../../shared/pdf/Report';
import { renderReportDocx, docxKey, fitsMail, type DocxInput } from '../../server/docx';
import { bidiSegments } from '../../server/docx-xml';
import { DOCX_TEMPLATES } from '../../server/docx-templates.gen';

const PNG = {
  contentType: 'image/png',
  data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
};

type Fixture = { formId: string; revision: number; inspectorName: string; approver: { name: string; date: string }; settings: { companyName: string; companyDetails: string }; data: FormData };
const load = (id: string): Fixture => JSON.parse(readFileSync(new URL(`../fixtures/${id}.json`, import.meta.url), 'utf8'));

const norm = (s: string) =>
  s
    .replace(/[״“”„]/g, '"')
    .replace(/[׳‘’`]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[_…\s ]+/g, '');
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const el = (n: unknown): n is Element => !!n && (n as Element).nodeType === 1;
function children(n: Element, name: string): Element[] {
  const out: Element[] = [];
  for (let c = n.firstChild; c; c = c.nextSibling) if (el(c) && c.nodeName === name) out.push(c);
  return out;
}
// paragraph text without nested paragraphs
function ptext(p: Element): string {
  let s = '';
  const walk = (n: Element) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (!el(c) || c.nodeName === 'w:p' || c.nodeName === 'mc:Fallback') continue;
      if (c.nodeName === 'w:t') s += c.textContent;
      else if (c.nodeName === 'w:tab') s += '\t';
      else walk(c);
    }
  };
  walk(p);
  return s;
}

type Parsed = { files: Record<string, Uint8Array>; paras: string[]; rows: Element[]; xml: string; text: string };
function parse(bytes: Uint8Array): Parsed {
  const files = unzipSync(bytes);
  const xml = strFromU8(files['word/document.xml']);
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const ps = Array.from(doc.getElementsByTagName('w:p') as unknown as ArrayLike<Element>);
  const paras = ps.map(ptext);
  const rows = Array.from(doc.getElementsByTagName('w:tr') as unknown as ArrayLike<Element>);
  return { files, paras, rows, xml, text: paras.join('\n') };
}
const cellText = (tc: Element) => children(tc, 'w:p').map(ptext).join('\n');
const rowCells = (tr: Element) => children(tr, 'w:tc').map(cellText);

// row (or paragraph) holding a check, by its requirement text
const loose = (s: string) => s.replace(/✓/g, '').replace(/[^\p{L}\p{N}]/gu, '');
// inline values are written into the requirement text, so strip them first
function checkHost(p: Parsed, f: CheckField, inline: string[] = []): string | undefined {
  const n = loose(f.text);
  const clean = (c: string) => loose(inline.filter(Boolean).reduce((s, x) => s.split(x).join(''), c));
  for (const tr of p.rows) if (rowCells(tr).some((c) => clean(c) === n || (clean(c).includes(n) && n.length > 3))) return rowCells(tr).join('\n');
  return p.paras.find((t) => clean(t).includes(n));
}

const NA = '(?:ל"ר|ל\\.ר|ל"י|לא רלוונטי|ב"י)';
const variant = (a: string) => (/^(ל"ר|ב"י|ל"י)$/.test(a) ? NA : reEsc(norm(a)));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

function answerShown(before: string, after: string, answer: string): boolean {
  const v = variant(answer);
  const plain = new RegExp(`(?<!לא)${v}`);
  // final letters folded so "מתאים" also matches "מתאימה"
  const fold = (x: string) => x.replace(/ם/g, 'מ').replace(/ן/g, 'נ');
  if (new RegExp(`(?<!לא)${fold(v)}ה?✓`).test(fold(norm(after)))) return true;
  return count(norm(after), plain) > count(norm(before), plain);
}

function leaves(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string' || typeof v === 'number') {
    if (String(v).trim()) out.push(String(v));
  } else if (Array.isArray(v)) v.forEach((x) => leaves(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => leaves(x, out));
  return out;
}

function input(fx: Fixture, revision = fx.revision): DocxInput {
  const def = getForm(fx.formId);
  const images: DocxInput['images'] = { inspectorSignature: [PNG], photos: [PNG, PNG, PNG] };
  for (const s of def.sections)
    for (const f of s.fields) {
      if (f.type === 'drawing' || f.type === 'contactAck') images[f.id] = [PNG];
    }
  return {
    def,
    data: fx.data,
    images,
    revision,
    inspectorName: fx.inspectorName,
    settings: { ...fx.settings, stamp: PNG },
    approver: { ...fx.approver, signature: PNG },
  };
}

describe('bidiSegments', () => {
  it('splits latin words out of hebrew text', () => {
    expect(bidiSegments('גלאי עשן דגם SD-851 כמות 12')).toEqual([
      { text: 'גלאי עשן דגם ', rtl: true },
      { text: 'SD-851', rtl: false },
      { text: ' כמות 12', rtl: true },
    ]);
    expect(bidiSegments('תיאור – Model X-24')).toEqual([
      { text: 'תיאור – ', rtl: true },
      { text: 'Model X-24', rtl: false },
    ]);
    expect(bidiSegments('04-8555123')).toEqual([{ text: '04-8555123', rtl: false }]);
  });
});

describe('renderReportDocx', () => {
  it('has a template for every form', () => {
    for (const def of FORMS) expect(DOCX_TEMPLATES[`${def.id}:${def.version}`]).toBeTruthy();
    expect(docxKey('abc', 2)).toBe('docx/abc-r2.docx');
  });

  it('caps pdf plus docx at 20MB', () => {
    const mb = (n: number) => new Uint8Array(n * 1024 * 1024);
    expect(fitsMail(mb(15), mb(5))).toBe(true);
    expect(fitsMail(mb(15), new Uint8Array(5 * 1024 * 1024 + 1))).toBe(false);
  });

  it('fails loudly when two checks match one row', async () => {
    const def = getForm('detectors');
    const dup = {
      ...def,
      sections: def.sections.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === 'c2' ? { ...f, text: (s.fields.find((x) => x.id === 'c1') as CheckField).text } : f)) })),
    };
    await expect(renderReportDocx({ ...input(load('detectors')), def: dup })).rejects.toThrow(/claimed twice/);
  });

  it('renders empty submissions without images', async () => {
    for (const def of FORMS) {
      const out = parse(await renderReportDocx({ def, data: {}, images: {}, revision: 0, settings: { companyName: '', companyDetails: '' }, approver: { name: '', date: '2026-11-17' } }));
      expect(out.paras.length).toBeGreaterThan(10);
      expect(Object.keys(out.files).some((k) => k.startsWith('word/media/fill-'))).toBe(false);
    }
  });

  it('rejects an unknown form version', async () => {
    const fx = load('detectors');
    await expect(renderReportDocx({ ...input(fx), def: { ...getForm('detectors'), version: 99 } })).rejects.toThrow(/template/);
  });

  for (const def of FORMS) {
    describe(def.id, () => {
      const fx = load(def.id);
      let out: Parsed;
      let orig: Parsed;
      let allText = '';
      beforeAll(async () => {
        out = parse(await renderReportDocx(input(fx)));
        orig = parse(Buffer.from(DOCX_TEMPLATES[`${def.id}:${def.version}`], 'base64'));
        allText = norm(out.text);
      });

      it('is a valid docx', () => {
        expect(out.xml).toMatch(/^<\?xml/);
        expect(strFromU8(out.files['[Content_Types].xml'])).toContain('Extension="png"');
        const rels = strFromU8(out.files['word/_rels/document.xml.rels']);
        const media = Object.keys(out.files).filter((k) => k.startsWith('word/media/fill-'));
        for (const m of media) expect(rels).toContain(`Target="${m.slice(5)}"`);
        // stamp, approver, inspector, contact signatures, drawings, 3 photos
        const extra = def.sections.flatMap((s) => s.fields).filter((f) => f.type === 'drawing' || f.type === 'contactAck').length;
        expect(media).toHaveLength(3 + extra + 3);
        expect(out.xml).not.toMatch(/\{\{|\{%|\+\+\+/);
      });

      it('has header values, inspector and approver', () => {
        for (const k of ['testNumber', 'siteName', 'siteAddress', 'customerName']) expect(allText).toContain(norm(String(fx.data[k])));
        expect(allText).toContain(norm(formatDate(String(fx.data.date))));
        expect(allText).toContain(norm(fx.approver.name));
        expect(allText).toContain(norm(fx.inspectorName));
        expect(allText).toContain(norm(formatDate(fx.approver.date)));
      });

      it('contains every entered value', () => {
        const checks = new Set(def.sections.flatMap((s) => s.fields).filter((f) => f.type === 'check').map((f) => f.id));
        const missing: string[] = [];
        for (const [k, v] of Object.entries(fx.data)) {
          if (checks.has(k)) continue;
          for (const leaf of leaves(v)) {
            const s = /^\d{4}-\d{2}-\d{2}$/.test(leaf) ? formatDate(leaf) : leaf;
            if (!allText.includes(norm(s))) missing.push(`${k}: ${s}`);
          }
        }
        expect(missing).toEqual([]);
      });

      it('marks every check answer with its notes and inline values', () => {
        const bad: string[] = [];
        for (const f of def.sections.flatMap((s) => s.fields)) {
          if (f.type !== 'check') continue;
          const v = (fx.data[f.id] ?? {}) as CheckValue;
          const after = checkHost(out, f, Object.values(v.inline ?? {}));
          const before = checkHost(orig, f);
          if (after === undefined || before === undefined) {
            bad.push(`${f.id}: row not found`);
            continue;
          }
          const answers = [v.answer, f.answers === 'existsActive' && v.answer !== 'לא קיים' ? v.active : undefined].filter(Boolean) as string[];
          for (const a of answers) if (!answerShown(before, after, a)) bad.push(`${f.id}: answer ${a}`);
          if (v.note && !norm(after).includes(norm(v.note))) bad.push(`${f.id}: note`);
          for (const x of Object.values(v.inline ?? {})) if (x && !norm(after).includes(norm(x))) bad.push(`${f.id}: inline ${x}`);
        }
        expect(bad).toEqual([]);
      });

      it('keeps the static text of the original', () => {
        const outParas = out.paras.map((t) => norm(t.replace(/✓/g, '')));
        const lost = orig.paras
          .filter((t) => t.trim() && !t.includes('_'))
          .filter((t) => !outParas.some((o) => o.includes(norm(t))));
        expect(lost).toEqual([]);
      });

      it('shows the revision only when revised', async () => {
        expect(out.text.includes(`Rev ${fx.revision}`)).toBe(fx.revision > 0);
        if (fx.revision === 0) {
          const rev = parse(await renderReportDocx(input(fx, 2)));
          expect(rev.text).toContain('Rev 2');
        }
      });
    });
  }
});
