// fills the original Word forms with a submission's values
import type { Element, Node } from '@xmldom/xmldom';
import {
  ACTIVE_OPTIONS,
  ANSWER_OPTIONS,
  EXISTS_OPTIONS,
  type CheckField,
  type CheckValue,
  type ContactAckValue,
  type EquipmentRow,
  type Field,
  type FormData,
  type FormDef,
  type ScenarioTable,
} from '../shared/forms/types';
import { DOCX_TEMPLATES } from './docx-templates.gen';
import { Docx, all, kid, kids, norm, type DocxImage, type Fmt } from './docx-xml';

export type { DocxImage } from './docx-xml';

export type DocxInput = {
  def: FormDef;
  data: FormData;
  // fieldId -> images, oldest first
  images: Record<string, DocxImage[]>;
  settings: { companyName: string; companyDetails: string; stamp?: DocxImage };
  approver: { name: string; date: string; signature?: DocxImage };
  revision: number;
  inspectorName?: string;
};

export const docxKey = (id: string, revision: number) => `docx/${id}-r${revision}.docx`;

// gmail caps mail at 25MB after encoding
export const MAIL_ATTACH_LIMIT = 20 * 1024 * 1024;
export const fitsMail = (pdf: Uint8Array, docx: Uint8Array) => pdf.length + docx.length <= MAIL_ATTACH_LIMIT;

const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const blank = (v: unknown) => !str(v).trim();

export function formatDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

const MARK = '✓';
// letters and digits only
const loose = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '');
const SIG = { w: 4, h: 1.4 };
const STAMP = { w: 3, h: 3 };

// label regex tolerant to spacing and quote variants
function labelRe(label: string): RegExp {
  let src = '';
  for (const ch of label) {
    if (/\s/.test(ch)) src += '\\s*';
    else if (ch === ':') src += '\\s*:';
    else if (/["״”“]/.test(ch)) src += '["״”“]';
    else if (/['׳’]/.test(ch)) src += "['׳’]";
    else if (/[–—-]/.test(ch)) src += '\\s*[–—-]\\s*';
    else src += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(src, 'g');
}

class Filler {
  readonly data: FormData;
  constructor(
    readonly d: Docx,
    readonly p: DocxInput,
  ) {
    this.data = p.data;
  }

  v(id: string): string {
    return str(this.data[id]).trim();
  }

  // ---- paragraphs ----

  paras(): Element[] {
    return all(this.d.body, 'w:p');
  }

  // first paragraph containing all texts
  para(...texts: string[]): Element {
    const n = texts.map(norm);
    const p = this.paras().find((x) => {
      const t = norm(this.d.text(x));
      return n.every((s) => t.includes(s));
    });
    if (!p) throw new Error(`docx anchor missing: ${texts.join(' + ')}`);
    return p;
  }

  parasWith(text: string): Element[] {
    const n = norm(text);
    return this.paras().filter((x) => norm(this.d.text(x)).includes(n));
  }

  paraExact(text: string): Element {
    const p = this.paras().find((x) => norm(this.d.text(x)) === norm(text));
    if (!p) throw new Error(`docx anchor missing: ${text}`);
    return p;
  }

  // next body sibling paragraph with text
  nextPara(p: Element): Element {
    for (let n = p.nextSibling; n; n = n.nextSibling) if (n.nodeName === 'w:p' && this.d.text(n as Element).trim()) return n as Element;
    throw new Error('docx anchor missing: next paragraph');
  }

  line(p: Element): Line {
    return new Line(this, p);
  }

  append(p: Element, text: string, fmt: Fmt = {}) {
    if (!text) return;
    const len = this.d.text(p).length;
    this.d.replaceRange(p, len, len, this.d.runs(text, this.d.rPrAt(p, Math.max(len - 1, 0)), fmt));
  }

  appendNodes(p: Element, nodes: (Node | null)[]) {
    const len = this.d.text(p).length;
    this.d.replaceRange(p, len, len, nodes.filter((x): x is Node => !!x));
  }

  insertAfter(ref: Node, n: Node) {
    ref.parentNode!.insertBefore(n, ref.nextSibling);
  }

  // "label: value" paragraphs after anchor
  extras(anchor: Element, pairs: [string, unknown][]): Element {
    let last = anchor;
    for (const [label, v] of pairs) {
      if (blank(v)) continue;
      const base = this.d.rPrAt(anchor, 0);
      const p = this.d.para(anchor, [...this.d.runs(`${label}: `, base), ...this.d.runs(str(v), base, { u: true })]);
      this.insertAfter(last, p);
      last = p;
    }
    return last;
  }

  // fills the underscore-only paragraphs after anchor, line by line
  lines(anchor: Element, text: string) {
    if (!text.trim()) return;
    const targets: Element[] = [];
    for (let n = anchor.nextSibling; n; n = n.nextSibling) {
      if (n.nodeName !== 'w:p') break;
      const t = this.d.text(n as Element);
      if (!t.trim()) continue;
      if (/^[\s_.]*$/.test(t) && t.includes('___')) targets.push(n as Element);
      else break;
    }
    const ls = text.split(/\r?\n/);
    if (!targets.length) {
      this.insertAfter(anchor, this.d.para(anchor, this.d.runs(text, this.d.rPrAt(anchor, 0))));
      return;
    }
    targets.forEach((p, i) => {
      const chunk = i < targets.length - 1 ? ls[i] : ls.slice(i).join('\n');
      if (chunk === undefined || !chunk.trim()) return;
      const t = this.d.text(p);
      const a = t.indexOf('_');
      const b = t.lastIndexOf('_') + 1;
      this.d.replaceRange(p, a, b, this.d.runs(chunk, this.d.rPrAt(p, a)));
    });
  }

  // puts a mark after the chosen option (into its blank when there is one)
  mark(p: Element, options: string[], idx: number, from = 0): boolean {
    if (idx < 0 || idx >= options.length) return false;
    const t = this.d.text(p);
    let c = from;
    let end = -1;
    for (let i = 0; i <= idx; i++) {
      const re = labelRe(options[i]);
      re.lastIndex = c;
      const m = re.exec(t);
      if (!m) return false;
      c = m.index + m[0].length;
      end = c;
    }
    let q = end;
    while (t[q] === ' ') q++;
    let e = q;
    while (t[e] === '_') e++;
    const base = this.d.rPrAt(p, end - 1);
    if (e > q) this.d.replaceRange(p, q, e, this.d.runs(` ${MARK} `, base, { b: true, u: true }));
    else this.d.replaceRange(p, end, end, this.d.runs(` ${MARK}`, base, { b: true }));
    return true;
  }

  // ---- tables ----

  table(...texts: string[]): Element {
    const n = texts.map(norm);
    const t = all(this.d.body, 'w:tbl').find((x) => {
      const s = norm(all(x, 'w:p').map((p) => this.d.text(p)).join(''));
      return n.every((k) => s.includes(k));
    });
    if (!t) throw new Error(`docx table missing: ${texts.join(' + ')}`);
    return t;
  }

  cellText(tc: Element): string {
    return kids(tc, 'w:p')
      .map((p) => this.d.text(p))
      .join('\n');
  }

  private rowCursor = 0;
  private claimed = new Set<Element>();

  // row holding the given text (exact cell first, then containing)
  row(text: string, scope?: Element): Element {
    const rows = all(scope ?? this.d.body, 'w:tr');
    const n = norm(text);
    const order = [...rows.slice(this.rowCursor), ...rows.slice(0, this.rowCursor)];
    const ln = loose(text);
    const tests = [
      (c: string) => norm(c) === n,
      (c: string) => norm(c).includes(n),
      (c: string) => loose(c).includes(ln),
      (c: string) => norm(c).length > 6 && n.includes(norm(c)) && norm(c).length >= n.length * 0.6,
    ];
    for (const test of tests) {
      const r = order.find((tr) => kids(tr, 'w:tc').some((tc) => test(this.cellText(tc))));
      if (r) {
        // two texts on one row means a wrong match
        if (this.claimed.has(r)) throw new Error(`docx row claimed twice: ${text.slice(0, 40)}`);
        this.claimed.add(r);
        if (!scope) this.rowCursor = rows.indexOf(r) + 1;
        return r;
      }
    }
    throw new Error(`docx row missing: ${text.slice(0, 40)}`);
  }

  cell(tr: Element, i: number): Element {
    const c = kids(tr, 'w:tc')[i];
    if (!c) throw new Error(`docx cell missing: ${i}`);
    return c;
  }

  // run props for text typed into a cell, at most 11pt
  cellRPr(tc: Element): Element | null {
    const p = kid(tc, 'w:p');
    const mark = p && kid(p, 'w:pPr') && kid(kid(p, 'w:pPr')!, 'w:rPr');
    const r = all(tc, 'w:r').find((x) => kid(x, 'w:t'));
    const rr = all(tc.parentNode as Element, 'w:r').find((x) => kid(x, 'w:t') && kid(x, 'w:rPr'));
    const src = mark || (r && kid(r, 'w:rPr')) || (rr && kid(rr, 'w:rPr'));
    if (!src) return null;
    const out = src.cloneNode(true) as Element;
    for (const name of ['w:sz', 'w:szCs']) {
      const sz = kid(out, name);
      if (sz && Number(sz.getAttribute('w:val')) > 22) sz.setAttribute('w:val', '22');
    }
    return out;
  }

  // writes into the first empty paragraph of a cell, else a new paragraph
  setCell(tc: Element, value: unknown, fmt: Fmt = {}) {
    if (blank(value)) return;
    this.cellNodes(tc, this.d.runs(str(value).trim(), this.cellRPr(tc), fmt));
  }

  cellNodes(tc: Element, nodes: (Node | null)[]) {
    const list = nodes.filter((x): x is Node => !!x);
    if (!list.length) return;
    const ps = kids(tc, 'w:p');
    const empty = ps.find((p) => !this.d.text(p).trim());
    if (empty && ps.length === 1) {
      // drop whitespace-only runs and the indent of the empty cell
      for (const r of all(empty, 'w:r')) if (kid(r, 'w:t')) r.parentNode!.removeChild(r);
      const pPr = kid(empty, 'w:pPr');
      const ind = pPr && kid(pPr, 'w:ind');
      if (ind) pPr!.removeChild(ind);
      this.appendNodes(empty, list);
    } else {
      const last = ps[ps.length - 1];
      const p = this.d.para(last, list);
      this.insertAfter(last, p);
    }
  }

  // appends text to the end of the cell's first paragraph
  cellAppend(tc: Element, value: unknown) {
    if (blank(value)) return;
    const p = kids(tc, 'w:p').find((x) => this.d.text(x).trim()) ?? kid(tc, 'w:p')!;
    this.append(p, ` ${str(value).trim()}`, { u: true });
  }

  // cell whose whole text is the label
  labelCell(label: string): Element {
    const n = norm(label);
    const c = all(this.d.body, 'w:tc').find((tc) => norm(this.cellText(tc)) === n);
    if (!c) throw new Error(`docx cell missing: ${label}`);
    return c;
  }

  // copy of a row with its text removed, inserted after it
  cloneRow(tr: Element): Element {
    const c = tr.cloneNode(true) as Element;
    for (const p of all(c, 'w:p')) for (const x of kids(p)) if (x.nodeName !== 'w:pPr') p.removeChild(x);
    this.insertAfter(tr, c);
    return c;
  }

  // writes records into table rows from `first`, adding rows as needed
  fillRows(tbl: Element, first: number, records: unknown[][], startCol = 0) {
    records.forEach((rec, i) => {
      let rows = kids(tbl, 'w:tr');
      while (rows.length <= first + i) {
        this.cloneRow(rows[rows.length - 1]);
        rows = kids(tbl, 'w:tr');
      }
      const tr = rows[first + i];
      rec.forEach((v, j) => {
        const tc = kids(tr, 'w:tc')[startCol + j];
        if (tc) this.setCell(tc, v);
      });
    });
  }

  img(fieldOrImg: string | DocxImage | undefined, box: { w: number; h: number }): Element | null {
    const im = typeof fieldOrImg === 'string' ? this.p.images[fieldOrImg]?.[0] : fieldOrImg;
    return im ? this.d.image(im, box.w, box.h) : null;
  }
}

class Line {
  private cursor = 0;
  constructor(
    private f: Filler,
    readonly p: Element,
  ) {}

  // fills the blank after label (or writes right after it)
  fill(label: string, value: unknown, fmt: Fmt = { u: true }): this {
    const d = this.f.d;
    const t = d.text(this.p);
    const re = labelRe(label);
    re.lastIndex = this.cursor;
    const m = re.exec(t);
    if (!m) throw new Error(`docx label missing: ${label}`);
    const pos = m.index + m[0].length;
    let q = pos;
    while (q < t.length && /[ : ]/.test(t[q])) q++;
    let e = q;
    while (t[e] === '_') e++;
    const nodes = Array.isArray(value) ? (value as (Node | null)[]).filter((x): x is Node => !!x) : null;
    if (nodes ? !nodes.length : blank(value)) {
      this.cursor = e > q ? e : pos;
      return this;
    }
    const has = e > q;
    const pre = !has && q > 0 && !/\s/.test(t[q - 1]) ? ' ' : '';
    const post = !has && q < t.length && !/\s/.test(t[q]) ? ' ' : '';
    const text = nodes ? '' : has ? ` ${str(value).trim()} ` : `${pre}${str(value).trim()}${post}`;
    const ins = nodes ?? d.runs(text, d.rPrAt(this.p, has ? q : Math.max(pos - 1, 0)), fmt);
    d.replaceRange(this.p, q, has ? e : q, ins);
    this.cursor = q + text.length;
    return this;
  }
}

// ---- shared form parts ----

function equipmentRow(value: unknown, row: string, i: number): EquipmentRow {
  if (Array.isArray(value)) return (value[i] ?? {}) as EquipmentRow;
  if (value && typeof value === 'object') {
    const r = value as Record<string, EquipmentRow>;
    return r[String(i)] ?? r[row] ?? {};
  }
  return {};
}

const fieldsOf = (def: FormDef) => def.sections.flatMap((s) => s.fields);
const fieldById = <T extends Field['type']>(def: FormDef, id: string, type: T) =>
  fieldsOf(def).find((f) => f.id === id && f.type === type) as Extract<Field, { type: T }> | undefined;

function equipment(f: Filler, id = 'equipment') {
  const def = fieldById(f.p.def, id, 'equipmentTable');
  if (!def) return;
  const tbl = f.table('סוג האביזר');
  const rows = kids(tbl, 'w:tr');
  const used = new Set<Element>();
  def.rows.forEach((label, i) => {
    const r = equipmentRow(f.data[id], label, i);
    if (blank(r.manufacturer) && blank(r.model) && blank(r.qty)) return;
    let tr = rows.find((x) => !used.has(x) && norm(f.cellText(f.cell(x, 0))) === norm(label));
    if (!tr) {
      tr = rows.find((x) => !used.has(x) && kids(x, 'w:tc').every((tc) => !f.cellText(tc).trim())) ?? f.cloneRow(rows[rows.length - 1]);
      f.setCell(f.cell(tr, 0), label);
    }
    used.add(tr);
    f.setCell(f.cell(tr, 1), r.manufacturer);
    f.setCell(f.cell(tr, 2), r.model);
    f.setCell(f.cell(tr, 3), r.qty);
  });
}

function repeat(f: Filler, id: string, tbl: Element, first: number, cols: string[]) {
  const rows = (Array.isArray(f.data[id]) ? f.data[id] : []) as Record<string, unknown>[];
  f.fillRows(
    tbl,
    first,
    rows.map((r) => cols.map((c) => r?.[c])),
  );
}

const PROTECTED_COLS = ['no', 'desc', 'location', 'risk', 'dims', 'volume', 'agentWeight'];

function contactAcks(f: Filler, ids: string[]) {
  const lines = f.paras().filter((p) => {
    const t = norm(f.d.text(p));
    return t.includes('תפקיד:') && t.includes('טלפון:');
  });
  ids.forEach((id, i) => {
    const p = lines[i];
    if (!p) throw new Error(`docx anchor missing: contact ${id}`);
    const c = (f.data[id] ?? {}) as ContactAckValue;
    f.line(p).fill('שם:', c.name).fill('תפקיד:', c.role).fill('טלפון:', c.phone).fill('שעה:', c.time);
    const sig = f.nextPara(p);
    if (norm(f.d.text(sig)).includes('חתימה')) f.line(sig).fill('חתימה:', [f.img(id, SIG)]);
  });
}

function defects(f: Filler) {
  f.lines(f.para('פירוט ליקויים והערות'), f.v('defects'));
}

function inspectorLine(f: Filler, p: Element, nameLabel: string) {
  f.line(p).fill(nameLabel, f.p.inspectorName).fill('חתימה:', [f.img('inspectorSignature', SIG)]);
}

// approval paragraph after p: name, date, signature, stamp
function approverAfter(f: Filler, p: Element, label: string) {
  const base = f.d.rPrAt(p, 0);
  const a = f.p.approver;
  const nodes: (Node | null)[] = [
    ...f.d.runs(`${label}: `, base),
    ...f.d.runs(a.name || ' ', base, { u: true }),
    ...f.d.runs('   תאריך אישור: ', base),
    ...f.d.runs(formatDate(a.date), base, { u: true }),
    ...f.d.runs('   חתימה: ', base),
    f.img(a.signature, SIG),
    ...f.d.runs('  ', base),
    f.img(f.p.settings.stamp, STAMP),
  ];
  const np = f.d.para(p, nodes.filter((x): x is Node => !!x));
  f.insertAfter(p, np);
}

// drawings replace the empty grid table after the heading, or follow it
function drawing(f: Filler, id: string, heading: Element) {
  const imgs = f.p.images[id] ?? [];
  if (!imgs.length) return;
  let next: Node | null = heading.nextSibling;
  while (next && next.nodeName === 'w:p' && !f.d.text(next as Element).trim()) next = next.nextSibling;
  const grid = next && next.nodeName === 'w:tbl' && !norm(all(next as Element, 'w:p').map((p) => f.d.text(p)).join('')) ? (next as Element) : null;
  let last: Node = heading;
  for (const im of imgs) {
    const run = f.d.image(im, 14.5, 18);
    if (!run) continue;
    const p = f.d.para(heading, [run], { center: true });
    f.insertAfter(last, p);
    last = p;
  }
  if (grid && last !== heading) grid.parentNode!.removeChild(grid);
}

type CheckLayout = {
  textCol: number;
  result: { col: number; mode: 'mark' | 'write'; options?: string[] };
  note: number | 'text';
};

function answerIdx(f: CheckField, answer: string): number {
  if (f.answers === 'existsActive') return EXISTS_OPTIONS.indexOf(answer);
  return ANSWER_OPTIONS[f.answers].indexOf(answer);
}

function inlineValues(f: Filler, tc: Element, check: CheckField, v: CheckValue) {
  const items = (check.inline ?? []).map((x) => ({ ...x, value: str(v.inline?.[x.id]).trim() }));
  if (!items.length) return;
  const ps = kids(tc, 'w:p');
  const blanks: { p: Element; a: number; b: number }[] = [];
  for (const p of ps) for (const m of f.d.text(p).matchAll(/_{2,}/g)) blanks.push({ p, a: m.index!, b: m.index! + m[0].length });
  if (blanks.length >= items.length) {
    // fill from the end so offsets stay valid
    for (let i = items.length - 1; i >= 0; i--) {
      if (!items[i].value) continue;
      const { p, a, b } = blanks[i];
      f.d.replaceRange(p, a, b, f.d.runs(` ${items[i].value} `, f.d.rPrAt(p, a), { u: true }));
    }
    return;
  }
  for (const it of items) {
    if (!it.value) continue;
    const p = ps.find((x) => norm(f.d.text(x)).includes(norm(it.label)));
    if (p) f.line(p).fill(it.label, it.value);
    else f.cellNodes(tc, f.d.runs(`${it.label}: ${it.value}`, f.cellRPr(tc)));
  }
}

function noteText(v: CheckValue) {
  return str(v.note).trim() ? `הערה: ${str(v.note).trim()}` : '';
}

function checks(f: Filler, layout: CheckLayout, ids?: string[]) {
  for (const check of fieldsOf(f.p.def)) {
    if (check.type !== 'check' || (ids && !ids.includes(check.id))) continue;
    const v = (f.data[check.id] ?? {}) as CheckValue;
    const tr = f.row(check.text);
    const textCell = f.cell(tr, layout.textCol);
    inlineValues(f, textCell, check, v);
    const answer = str(v.answer);
    if (answer) {
      const rc = f.cell(tr, layout.result.col);
      let done = false;
      if (layout.result.mode === 'mark' && layout.result.options) {
        const opts = layout.result.options;
        const p = kids(rc, 'w:p').find((x) => labelRe(opts[0]).test(f.d.text(x)));
        if (p) done = f.mark(p, opts, answerIdx(check, answer));
      }
      if (!done) f.setCell(rc, answer, { b: true });
    }
    const note = layout.note === 'text' ? noteText(v) : str(v.note).trim();
    if (note) f.setCell(f.cell(tr, layout.note === 'text' ? layout.textCol : layout.note), note);
  }
}

const YES_NO_NA = ['כן', 'לא', 'ב"י'];

function rev(f: Filler) {
  if (f.p.revision <= 0) return;
  const p = f.d.para(null, f.d.runs(`Rev ${f.p.revision} (תיקון)`, null, { b: true }));
  f.d.body.insertBefore(p, f.d.body.firstChild);
}

function photos(f: Filler) {
  const srcs = fieldsOf(f.p.def)
    .filter((x) => x.type === 'photos')
    .flatMap((x) => f.p.images[x.id] ?? []);
  const sect = kids(f.d.body).find((x) => x.nodeName === 'w:sectPr') ?? null;
  const pages = Math.ceil(srcs.length / 2);
  srcs.forEach((im, i) => {
    if (i % 2 === 0) {
      const h = f.d.para(null, f.d.runs(`נספח תמונות (${i / 2 + 1}/${pages})`, null, { b: true }), { pageBreakBefore: true, center: true });
      f.d.body.insertBefore(h, sect);
    }
    const run = f.d.image(im, 14.5, 10);
    if (run) f.d.body.insertBefore(f.d.para(null, [run], { center: true }), sect);
  });
}

// ---- forms ----

function header1220Like(f: Filler, opts: { owner?: boolean }) {
  const d = f.data;
  f.line(f.para('תאריך הבדיקה', "מס' בדיקה")).fill('תאריך הבדיקה', formatDate(f.v('date'))).fill("מס' בדיקה", d.testNumber);
  f.line(f.para('שם האתר', 'כתובת האתר')).fill('שם האתר', d.siteName).fill('כתובת האתר', d.siteAddress);
  f.line(f.para('שם המזמין')).fill('שם המזמין', d.customerName).fill('כתובת', d.customerAddress).fill('טל.', d.customerPhone);
  f.line(f.para('כתובת דוא"ל', 'שם המתקין')).fill('כתובת דוא"ל', d.customerEmail).fill('שם המתקין', d.installerName).fill('כתובת', d.installerAddress);
  if (opts.owner) f.line(f.para('בעל האתר')).fill('בעל האתר: שם', d.ownerName).fill('ט. נייד', d.ownerMobile).fill('משרד', d.ownerOffice);
  const site = f.para('שטח המבנה');
  f.line(site).fill('שטח המבנה: כ', d.buildingArea).fill('גובה המבנה כ', d.buildingHeight);
  return site;
}

function fillF1220(f: Filler) {
  const d = f.data;
  header1220Like(f, {});
  f.line(f.para("מס' הזמנה", 'שעת התחלת הבדיקה')).fill("מס' הזמנה", d.orderNumber).fill('שעת התחלת הבדיקה', d.startTime).fill('שעת סיום', d.endTime);
  f.line(f.para('ייעוד המבנה')).fill('ייעוד המבנה', d.buildingPurpose);
  f.line(f.para('גוש', 'מגרש')).fill('גוש', d.gush).fill('חלקה', d.helka).fill('מגרש', d.migrash);
  f.line(f.para('ת.ז', 'טלפון')).fill('טלפון', d.installerPhone).fill('ת.ז', d.installerId);
  f.line(f.para('תיאור המבנה')).fill('תיאור המבנה', d.buildingDescription);
  const prot = f.para('חללים מוגנים (פרט');
  f.line(prot).fill('שטח חללים מוגנים: כ', d.protectedArea);
  f.lines(prot, f.v('protectedSpaces'));
  f.lines(f.para('חללים שאינם מוגנים'), f.v('unprotectedSpaces'));
  f.lines(f.para('הוצגו דרישות רשות הכבאות'), f.v('authorityRequirements'));
  const risk = fieldById(f.p.def, 'riskLevel', 'choice');
  if (risk) f.mark(f.para('סיווג האתר'), risk.options, risk.options.indexOf(f.v('riskLevel')));
  f.line(f.para('מיקום רכזת גילוי אש')).fill('מיקום רכזת גילוי אש:', d.panelLocation);

  contactAcks(f, ['noticeAck1', 'noticeAck2']);
  f.line(f.para('מספר קו טלפון המחובר לחייגן')).fill('מספר קו טלפון המחובר לחייגן:', d.dialerPhone);
  const mgr = (d.managerDeclaration ?? {}) as ContactAckValue;
  const mp = f.para('חתימה וחותמת');
  f.line(mp).fill('שם:', mgr.name).fill('תפקיד:', mgr.role).fill('חתימה וחותמת:', [f.img('managerDeclaration', SIG)]);
  f.append(mp, [mgr.phone ? `  טלפון: ${mgr.phone}` : '', mgr.time ? `  שעה: ${mgr.time}` : ''].join(''));

  equipment(f);
  const insp = f.para('שם בודק:', 'חתימה:');
  inspectorLine(f, insp, 'שם בודק:');
  approverAfter(f, insp, 'שם המאשר');

  // connected systems grid: name, yes/no pairs
  const grid = fieldById(f.p.def, 'connected', 'systemsGrid');
  const vals = (d.connected && typeof d.connected === 'object' ? d.connected : {}) as Record<string, unknown>;
  if (grid) {
    const tbl = f.table('מחובר?');
    const cells = kids(tbl, 'w:tr').flatMap((tr) => kids(tr, 'w:tc'));
    for (const name of grid.systems) {
      const i = cells.findIndex((c) => norm(f.cellText(c)) === norm(name));
      const yn = ['כן', 'לא'].indexOf(str(vals[name]));
      if (i >= 0 && yn >= 0) f.mark(kids(cells[i + 1], 'w:p').find((p) => f.d.text(p).includes('כן'))!, ['כן', 'לא'], yn);
    }
    const others = Object.keys(vals).filter((k) => !grid.systems.includes(k) && str(vals[k]));
    const oi = cells.findIndex((c) => norm(f.cellText(c)).startsWith('אחר'));
    if (others.length && oi >= 0) {
      const p = kids(cells[oi], 'w:p').find((x) => f.d.text(x).includes('אחר'))!;
      f.line(p).fill('אחר', others.map((k) => (others.length > 1 ? `${k} (${str(vals[k])})` : k)).join(', '));
      const yn = ['כן', 'לא'].indexOf(str(vals[others[0]]));
      if (others.length === 1 && yn >= 0) f.mark(kids(cells[oi + 1], 'w:p').find((x) => f.d.text(x).includes('כן'))!, ['כן', 'לא'], yn);
    }
  }

  checks(f, { textCol: 2, result: { col: 3, mode: 'mark', options: YES_NO_NA }, note: 'text' });
  const panels = (Array.isArray(d.panels) ? d.panels : []) as Record<string, unknown>[];
  f.fillRows(
    f.table('פירוט לוח חשמל'),
    1,
    panels.map((r, i) => [String(i + 1), r?.detail, r?.location, r?.cutoff]),
  );
  defects(f);
}

function fillGasAerosol(f: Filler, kind: 'gas' | 'aerosol') {
  const d = f.data;
  const site = header1220Like(f, { owner: true });
  f.line(f.para('יעוד המבנה', 'שעת התחלת הבדיקה')).fill('יעוד המבנה', d.buildingPurpose).fill('שעת התחלת הבדיקה', d.startTime).fill('שעת סיום', d.endTime);
  f.lines(site, f.v('buildingDescription'));
  const email = f.para('כתובת דוא"ל', 'שם המתקין');
  if (kind === 'gas') {
    f.line(f.para('גוש', 'מגרש')).fill('גוש', d.gush).fill('חלקה', d.helka).fill('מגרש', d.migrash);
    f.extras(email, [
      ["מס' הזמנה", d.orderNumber],
      ['טלפון המתקין', d.installerPhone],
      ['ת.ז המתקין', d.installerId],
    ]);
  } else {
    f.line(f.para('גוש', 'חלקה')).fill('גוש', d.gush).fill('חלקה', d.helka);
    const phone = f.nextPara(email);
    f.line(phone).fill('טלפון', d.installerPhone);
    f.extras(phone, [
      ['מגרש', d.migrash],
      ["מס' הזמנה", d.orderNumber],
      ['ת.ז המתקין', d.installerId],
    ]);
  }
  repeat(f, 'protectedSpaces', f.table('תיאור החלל המוגן'), 1, PROTECTED_COLS);
  equipment(f);
  if (kind === 'gas') f.append(f.paraExact('חייגן:'), ` ${f.v('dialer')}`.trimEnd(), { u: true });
  contactAcks(f, ['noticeAck1', 'noticeAck2']);
  f.line(f.para('מספר קו טלפון המחובר לחייגן')).fill('מספר קו טלפון המחובר לחייגן:', d.dialerPhone);

  if (kind === 'aerosol') {
    checks(f, { textCol: 1, result: { col: 2, mode: 'mark', options: YES_NO_NA }, note: 3 });
    drawing(f, 'installDrawing', f.para('תרשים התקנת המחולל בחלל המוגן'));
  } else {
    checks(f, { textCol: 1, result: { col: 2, mode: 'mark', options: YES_NO_NA }, note: 'text' });
    const heads = f.parasWith('תרשים התקנת בפועל בחלל המוגן');
    tanks(f);
    drawing(f, 'installDrawing', heads[0]);
    drawing(f, 'installDrawing2', heads[1]);
  }
  defects(f);
  const insp = f.para('שם בודק:', 'חתימה:');
  inspectorLine(f, insp, 'שם בודק:');
  approverAfter(f, insp, 'שם המאשר');
}

// tank table is transposed: one column per tank
function tanks(f: Filler) {
  const rows = (Array.isArray(f.data.tanks) ? f.data.tanks : []) as Record<string, unknown>[];
  if (!rows.length) return;
  const tbl = f.table('נפץ/ סולנואיד', 'חימוש המכל');
  const trs = kids(tbl, 'w:tr');
  const slots = kids(trs[0], 'w:tc').length - 1;
  rows.slice(0, slots).forEach((r, i) => {
    f.cellAppend(f.cell(trs[0], i + 1), r?.desc);
    for (let k = 1; k < trs.length && k <= 15; k++) f.setCell(f.cell(trs[k], i + 1), r?.[`t${k}`]);
  });
  // more tanks than columns go below the table
  const def = fieldById(f.p.def, 'tanks', 'repeatTable');
  let last: Element = tbl;
  rows.slice(slots).forEach((r, j) => {
    const text = (def?.columns ?? [])
      .map((c) => (blank(r?.[c.id]) ? '' : `${c.label}: ${str(r[c.id])}`))
      .filter(Boolean)
      .join(' | ');
    const p = f.d.para(null, f.d.runs(`מכל ${slots + j + 1}: ${text}`, f.cellRPr(f.cell(trs[1], 0))));
    f.insertAfter(last, p);
    last = p;
  });
}

function fillDetectors(f: Filler) {
  const d = f.data;
  const date = formatDate(f.v('date'));
  f.line(f.para('תאריך הבדיקה', "מס' בדיקה")).fill('תאריך הבדיקה', date).fill("מס' בדיקה", d.testNumber);
  f.line(f.para('פרטי המבנה וההזמנה')).fill('פרטי המבנה וההזמנה', d.siteName);
  f.line(f.para('כתובת המבנה')).fill('כתובת המבנה', d.siteAddress).fill("מס' הזמנה", d.orderNumber);
  f.line(f.para('גוש', 'חלקה')).fill('גוש', d.gush).fill('חלקה', d.helka);
  f.line(f.para('שם החברה')).fill('שם החברה', d.companyName).fill('כתובת', d.companyAddress);
  f.line(f.para('שם משפחה המתקין')).fill('שם, שם משפחה המתקין', d.installerName).fill('כתובת', d.installerAddress);
  f.line(f.para('ת"ז', 'טל')).fill('ת"ז', d.installerId).fill('טל', d.installerPhone);
  f.line(f.para("מס' קומות")).fill("מס' קומות", d.floors).fill("מס' דירות בבניין", d.apartmentsInBuilding);
  const last = f.para("מס' דירות שהותקנו");
  f.line(last).fill("מס' דירות שהותקנו גלאים עצמאיים", d.apartmentsWithDetectors);
  f.extras(last, [
    ['מגרש', d.migrash],
    ['ייעוד המבנה', d.buildingPurpose],
    ['שם המזמין', d.customerName],
    ['כתובת המזמין', d.customerAddress],
    ['טלפון המזמין', d.customerPhone],
    ['כתובת דוא"ל', d.customerEmail],
  ]);

  const info = f.table('פרטי גלאי עצמאי');
  const ir = kids(info, 'w:tr');
  ['detectorModel', 'detectorMaker', 'detectorLocation', 'batteryModel'].forEach((id, i) => f.setCell(f.cell(ir[2], i), d[id]));

  checks(
    f,
    { textCol: 1, result: { col: 3, mode: 'write' }, note: 2 },
    fieldsOf(f.p.def)
      .filter((x) => x.type === 'check' && x.id !== 'conclusion')
      .map((x) => x.id),
  );
  repeat(f, 'apartments', f.table('מיקום גלאים', 'כמות גלאים'), 1, ['floor', 'apartment', 'count', 'location']);

  // conclusion: mark the wording in the sentence
  const cv = (d.conclusion ?? {}) as CheckValue;
  const ctbl = f.table('מסקנה :');
  const ctc = f.cell(kids(ctbl, 'w:tr')[1], 0);
  const cp = kids(ctc, 'w:p').find((p) => f.d.text(p).includes('מתאימה'))!;
  const ci = ANSWER_OPTIONS.conclusion.indexOf(str(cv.answer));
  if (cv.answer && !f.mark(cp, ['מתאימה', 'לא מתיאמה'], ci, f.d.text(cp).indexOf('בדירות'))) f.setCell(ctc, cv.answer, { b: true });
  f.setCell(ctc, noteText(cv));

  // signature table
  const st = f.table('שם הבודק', 'שם המאשר');
  const [ri, ra] = kids(st, 'w:tr');
  f.setCell(f.cell(ri, 1), f.p.inspectorName);
  f.cellAppend(f.cell(ri, 2), date);
  f.cellNodes(f.cell(ri, 3), [f.img('inspectorSignature', SIG)]);
  f.setCell(f.cell(ra, 1), f.p.approver.name);
  f.cellAppend(f.cell(ra, 2), formatDate(f.p.approver.date));
  f.cellNodes(f.cell(ra, 3), [f.img(f.p.approver.signature, SIG), f.img(f.p.settings.stamp, STAMP)]);
  defects(f);
}

function fillF536(f: Filler) {
  const d = f.data;
  const date = formatDate(f.v('date'));
  const lc = (label: string, v: unknown) => f.cellAppend(f.labelCell(label), v);
  lc('שם המזמין:', d.customerName);
  lc('שם אתר:', d.siteName);
  lc('כתובת:', d.customerAddress);
  lc('כתובת אתר:', d.siteAddress);
  lc('שם מתכנן:', d.designerName);
  lc("מס' הזמנה:", d.orderNumber);
  lc('גוש:', d.gush);
  lc('חלקה:', d.helka);
  const mig = f.labelCell('מגרש:');
  f.cellAppend(mig, d.migrash);
  const contact = [f.v('customerPhone') && `טלפון: ${f.v('customerPhone')}`, f.v('customerEmail') && `דוא"ל: ${f.v('customerEmail')}`].filter(Boolean).join('\n');
  const spare = mig.nextSibling as Element | null;
  if (spare && spare.nodeName === 'w:tc') f.setCell(spare, contact);

  const kind = fieldById(f.p.def, 'inspectionType', 'choice');
  if (kind) {
    const p = f.para('למבנה חדש', 'ביקורת תקופתית');
    f.mark(p, ['מבנה חדש', 'ביקורת תקופתית'], kind.options.indexOf(f.v('inspectionType')));
  }
  lc("בדיקה מס':", d.testNumber);
  lc('תאריך בדיקה:', date);
  const prev = f.labelCell("מס' תעודה קודמת");
  f.setCell(prev.nextSibling as Element, d.previousCertNumber);

  const siteRows: [string, string][] = [
    ['סיווג הבניין לפי גובה:', 'heightClass'],
    ['פירוט קומות:', 'floorsDetail'],
    ['ייעוד המבנה:', 'buildingPurpose'],
    ['הבדיקה היא בשלב:', 'inspectionStage'],
    ['גובה חלל נבדק:', 'testedSpaceHeight'],
  ];
  for (const [label, id] of siteRows) f.setCell(f.labelCell(label).nextSibling as Element, d[id]);

  // documents list: source / number / fit columns
  f.cellAppend(f.cell(f.row('שלב הבדיקה -'), 0), d.docsStage);
  for (const c of fieldsOf(f.p.def)) {
    if (c.type !== 'check' || !c.id.startsWith('doc')) continue;
    const v = (d[c.id] ?? {}) as CheckValue;
    const tr = f.row(c.text, f.table('מס\' מסמך', 'התאמה'));
    f.setCell(f.cell(tr, 1), v.inline?.source);
    f.setCell(f.cell(tr, 2), v.inline?.docNumber);
    f.setCell(f.cell(tr, 3), v.answer, { b: true });
    f.setCell(f.cell(tr, 0), noteText(v));
  }

  // participants: preset system rows first
  const pt = f.table('נציג חברה');
  const prow = kids(pt, 'w:tr').slice(1);
  const used = new Set<Element>();
  for (const r of (Array.isArray(d.participants) ? d.participants : []) as Record<string, unknown>[]) {
    let tr = prow.find((x) => !used.has(x) && norm(f.cellText(f.cell(x, 2))) === norm(str(r?.system)) && norm(str(r?.system)));
    if (!tr) {
      tr = prow.find((x) => !used.has(x) && !f.cellText(f.cell(x, 2)).trim()) ?? f.cloneRow(kids(pt, 'w:tr').slice(-1)[0]);
      prow.push(tr);
      f.setCell(f.cell(tr, 2), r?.system);
    }
    used.add(tr);
    f.setCell(f.cell(tr, 0), r?.name);
    f.setCell(f.cell(tr, 1), r?.company);
  }

  // installed systems
  const grid = fieldById(f.p.def, 'installedSystems', 'systemsGrid');
  if (grid) {
    const vals = (d.installedSystems && typeof d.installedSystems === 'object' ? d.installedSystems : {}) as Record<string, unknown>;
    const tbl = f.table('מותקן');
    const names = [...grid.systems, ...Object.keys(vals).filter((k) => !grid.systems.includes(k) && str(vals[k]))];
    const r0 = kids(tbl, 'w:tr')[0];
    f.setCell(f.cell(r0, 1), vals[names[0]], { b: true });
    f.fillRows(
      tbl,
      1,
      names.slice(1).map((n) => [n, vals[n]]),
    );
  }

  // document review: number, topic, fit mark, notes
  const rv = (Array.isArray(d.docReview) ? d.docReview : []) as Record<string, unknown>[];
  const fit = ['מתאים', 'לא מתאים', 'ל"י'];
  f.fillRows(
    f.table('נושאים לבדיקה', 'התאמה לתקון'),
    2,
    rv.map((r, i) => {
      const k = fit.indexOf(str(r?.fit));
      return [String(i + 1), r?.topic, k === 0 ? MARK : '', k === 1 ? MARK : '', k === 2 ? MARK : '', r?.notes];
    }),
  );

  const routine: [string, string][] = [
    ['מצב משאבת אש', 'routinePump'],
    ['מצב מערכת פינוי עשן', 'routineSmoke'],
    ['מצב מערכת מיזוג', 'routineAc'],
    ['מעליות :', 'routineElevators'],
    ['תאורת חירום', 'routineLighting'],
  ];
  for (const [label, id] of routine) f.line(f.paras().find((p) => norm(f.d.text(p)).startsWith(norm(label)))!).fill(label, d[id]);
  f.line(f.para('סצנריות אירועים', 'שכולל')).fill('שכולל', d.scenarioPages);

  // fire panel items and actions
  for (const c of fieldsOf(f.p.def)) {
    if (c.type !== 'check') continue;
    const v = (d[c.id] ?? {}) as CheckValue;
    if (c.id.startsWith('panel')) {
      const tr = f.row(c.text, f.table('קיים/לא קיים', 'שילוט'));
      const ans = str(v.answer);
      if (ans) f.mark(kid(f.cell(tr, 1), 'w:p')!, ['קיים', 'לא קיים'], EXISTS_OPTIONS.indexOf(ans));
      if (ans !== 'לא קיים' && str(v.active)) f.mark(kid(f.cell(tr, 3), 'w:p')!, ['פעיל', 'לא פעיל'], ACTIVE_OPTIONS.indexOf(str(v.active)));
      f.setCell(f.cell(tr, 2), v.note);
    } else if (c.id.startsWith('action')) {
      const tr = f.row(c.text, f.table('פעולות', 'מתאים/לא מתאים/ל.ר'));
      if (str(v.answer)) {
        const p = kids(f.cell(tr, 1), 'w:p').find((x) => f.d.text(x).includes('מתאים'));
        if (!p || !f.mark(p, ['מתאים', 'לא מתאים', 'ל.ר'], answerIdx(c, str(v.answer)))) f.setCell(f.cell(tr, 1), v.answer, { b: true });
      }
      f.setCell(f.cell(tr, 0), noteText(v));
    } else if (c.id.startsWith('pre')) {
      const p = f.para(c.text);
      if (str(v.answer)) f.append(p, ` – ${str(v.answer)}`, { b: true });
      if (str(v.note).trim()) f.append(p, ` (${str(v.note).trim()})`);
    } else if (c.id === 'planConclusion') {
      for (const p of f.parasWith('תכנון המערכת מתאים')) {
        const from = f.d.text(p).indexOf('תכנון המערכת');
        if (str(v.answer) && !f.mark(p, ['מתאים', 'לא מתאים'], ANSWER_OPTIONS.conclusion.indexOf(str(v.answer)), from)) f.append(p, ` ${str(v.answer)}`, { b: true });
        if (str(v.note).trim()) f.append(p, ` ${noteText(v)}`);
      }
    }
  }

  scenarios(f);

  // defects into the lined table
  const lines = f.v('defects').split(/\r?\n/).filter((x) => x.trim());
  f.fillRows(
    defectsTable(f),
    0,
    lines.map((l) => [l]),
  );

  const insp = f.para('בודק', 'חתימה:', 'תאריך:');
  f.line(insp).fill('בודק', f.p.inspectorName).fill('חתימה:', [f.img('inspectorSignature', SIG)]).fill('תאריך:', date);
  const head = f.para('ראש תחום:');
  f.line(head).fill('ראש תחום:', f.p.approver.name);
  const base = f.d.rPrAt(head, 0);
  f.appendNodes(head, [
    ...f.d.runs('   תאריך אישור: ', base),
    ...f.d.runs(formatDate(f.p.approver.date), base, { u: true }),
    ...f.d.runs('   חתימה: ', base),
    f.img(f.p.approver.signature, SIG),
    ...f.d.runs('  ', base),
    f.img(f.p.settings.stamp, STAMP),
  ]);
}

// single-column lined table after the defects heading
function defectsTable(f: Filler): Element {
  const h = f.para('ליקויים:');
  for (let n = h.nextSibling; n; n = n.nextSibling) if (n.nodeName === 'w:tbl') return n as Element;
  throw new Error('docx table missing: defects');
}

function scenarios(f: Filler) {
  const def = fieldById(f.p.def, 'scenarios', 'scenarioMatrix');
  const tables = (Array.isArray(f.data.scenarios) ? f.data.scenarios : []) as ScenarioTable[];
  if (!def || !tables.length) return;
  const orig = f.table('טבלה מס', 'מיקום הבדיקה');
  const clean = orig.cloneNode(true) as Element;
  let last: Element = orig;
  const tbls = [orig];
  for (let i = 1; i < tables.length; i++) {
    const gap = f.d.para(null);
    f.insertAfter(last, gap);
    const t = clean.cloneNode(true) as Element;
    f.insertAfter(gap, t);
    tbls.push(t);
    last = t;
  }
  tables.forEach((t, ti) => {
    const tr = kids(tbls[ti], 'w:tr');
    const fv = t.fields ?? {};
    f.setCell(f.cell(tr[0], 1), fv.tableNo);
    f.cellAppend(f.cell(tr[0], 2), fv.location);
    f.cellAppend(f.cell(tr[1], 0), fv.detail);
    f.cellAppend(f.cell(tr[2], 0), fv.addresses);
    def.actions.forEach((a, ai) => {
      const row = tr[5 + ai];
      if (!row) return;
      if (!a) f.setCell(f.cell(row, 1), t.actionLabels?.[ai]);
      def.columns.forEach((_, ci) => f.setCell(f.cell(row, 2 + ci), t.cells?.[ai]?.[ci]));
    });
  });
}

const FILLERS: Record<string, (f: Filler) => void> = {
  f1220: fillF1220,
  f536: fillF536,
  detectors: fillDetectors,
  aerosol: (f) => fillGasAerosol(f, 'aerosol'),
  gas: (f) => fillGasAerosol(f, 'gas'),
};

export async function renderReportDocx(p: DocxInput): Promise<Buffer> {
  const b64 = DOCX_TEMPLATES[`${p.def.id}:${p.def.version}`];
  const fill = FILLERS[p.def.id];
  if (!b64 || !fill) throw new Error(`no docx template for ${p.def.id} v${p.def.version}`);
  const d = new Docx(new Uint8Array(Buffer.from(b64, 'base64')));
  const f = new Filler(d, p);
  fill(f);
  rev(f);
  photos(f);
  return Buffer.from(d.toBytes());
}
