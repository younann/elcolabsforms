// low-level docx editing: zip, document dom, runs, images
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { DOMParser, XMLSerializer, type Document, type Element, type Node } from '@xmldom/xmldom';

export const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';

export type DocxImage = { data: Uint8Array; contentType: string };

const HEBREW = /[֐-׿]/;
const LATIN = /[A-Za-z]/;

export const isEl = (n: Node | null | undefined): n is Element => !!n && n.nodeType === 1;
export const kids = (n: Node, name?: string): Element[] => {
  const out: Element[] = [];
  for (let c = n.firstChild; c; c = c.nextSibling) if (isEl(c) && (!name || c.nodeName === name)) out.push(c);
  return out;
};
export const kid = (n: Node, name: string): Element | undefined => kids(n, name)[0];
export const all = (n: Element | Document, name: string): Element[] => Array.from(n.getElementsByTagName(name) as unknown as ArrayLike<Element>);

// text normalization for matching
export function norm(s: string): string {
  return s
    .replace(/[״“”„]/g, '"')
    .replace(/[׳‘’`]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[_…\s ‎‏]+/g, '');
}

// bidi split: latin words (with digits/punct) are ltr, the rest rtl
export function bidiSegments(s: string): { text: string; rtl: boolean }[] {
  // marks and punctuation only follow the rtl paragraph
  if (!/[\p{L}\p{N}]/u.test(s)) return [{ text: s, rtl: true }];
  if (!HEBREW.test(s)) return [{ text: s, rtl: false }];
  const toks = s.match(/\s+|\S+/g) ?? [];
  const out: { text: string; rtl: boolean }[] = [];
  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    const ltr = !/\s/.test(t[0]) && LATIN.test(t) && !HEBREW.test(t);
    if (ltr) {
      // extend over following ltr words joined by spaces
      let j = i + 1;
      let end = i;
      while (j < toks.length) {
        const sp = toks[j];
        const next = toks[j + 1];
        if (/^\s+$/.test(sp) && next && LATIN.test(next) && !HEBREW.test(next)) {
          end = j + 1;
          j += 2;
        } else break;
      }
      out.push({ text: toks.slice(i, end + 1).join(''), rtl: false });
      i = end + 1;
    } else {
      const last = out[out.length - 1];
      if (last && last.rtl) last.text += t;
      else out.push({ text: t, rtl: true });
      i++;
    }
  }
  return out;
}

// schema order of rPr children
const RPR_ORDER = [
  'w:rStyle', 'w:rFonts', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:caps', 'w:smallCaps', 'w:strike', 'w:dstrike', 'w:outline', 'w:shadow',
  'w:emboss', 'w:imprint', 'w:noProof', 'w:snapToGrid', 'w:vanish', 'w:webHidden', 'w:color', 'w:spacing', 'w:w', 'w:kern', 'w:position',
  'w:sz', 'w:szCs', 'w:highlight', 'w:u', 'w:effect', 'w:bdr', 'w:shd', 'w:fitText', 'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang',
  'w:eastAsianLayout', 'w:specVanish', 'w:oMath',
];

const PPR_ORDER = [
  'w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:framePr', 'w:widowControl', 'w:numPr', 'w:suppressLineNumbers', 'w:pBdr',
  'w:shd', 'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku', 'w:wordWrap', 'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN',
  'w:bidi', 'w:adjustRightInd', 'w:snapToGrid', 'w:spacing', 'w:ind', 'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc',
  'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap', 'w:outlineLvl', 'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr', 'w:pPrChange',
];

type Seg = { run: Element; node: Element; start: number; text: string };

export type Fmt = { u?: boolean; b?: boolean };

export class Docx {
  files: Record<string, Uint8Array>;
  doc: Document;
  body: Element;
  private rels: Document;
  private types: Document;
  private nImg = 0;
  private nDocPr = 9000;

  constructor(bytes: Uint8Array) {
    this.files = unzipSync(bytes);
    this.doc = this.parse('word/document.xml');
    this.body = kid(this.doc.documentElement!, 'w:body')!;
    this.rels = this.parse('word/_rels/document.xml.rels');
    this.types = this.parse('[Content_Types].xml');
  }

  private parse(path: string): Document {
    const f = this.files[path];
    if (!f) throw new Error(`docx missing ${path}`);
    return new DOMParser().parseFromString(strFromU8(f), 'text/xml');
  }

  toBytes(): Uint8Array {
    const ser = new XMLSerializer();
    this.files['word/document.xml'] = strToU8(ser.serializeToString(this.doc));
    this.files['word/_rels/document.xml.rels'] = strToU8(ser.serializeToString(this.rels));
    this.files['[Content_Types].xml'] = strToU8(ser.serializeToString(this.types));
    return zipSync(this.files, { level: 6 });
  }

  el(name: string, attrs: Record<string, string> = {}, children: Node[] = []): Element {
    const e = this.doc.createElementNS(W_NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttributeNS(W_NS, k, v);
    for (const c of children) e.appendChild(c);
    return e;
  }

  // ---- text model ----

  segments(p: Element): Seg[] {
    const out: Seg[] = [];
    let pos = 0;
    const walk = (n: Element) => {
      for (const c of kids(n)) {
        const name = c.nodeName;
        if (name === 'w:p' || name === 'w:del' || name === 'mc:Fallback' || name === 'w:pPr') continue;
        if (name === 'w:r') {
          for (const x of kids(c)) {
            let t = '';
            if (x.nodeName === 'w:t') t = x.textContent ?? '';
            else if (x.nodeName === 'w:tab') t = '\t';
            else if (x.nodeName === 'w:br' || x.nodeName === 'w:cr') t = '\n';
            else if (x.nodeName === 'w:noBreakHyphen') t = '-';
            else continue;
            out.push({ run: c, node: x, start: pos, text: t });
            pos += t.length;
          }
        } else walk(c);
      }
    };
    walk(p);
    return out;
  }

  text(p: Element): string {
    return this.segments(p)
      .map((s) => s.text)
      .join('');
  }

  // split runs so that a run starts at offset
  private boundary(p: Element, off: number) {
    const seg = this.segments(p).find((s) => s.start <= off && off < s.start + s.text.length);
    if (!seg || (seg.start === off && seg.node === kids(seg.run).find((x) => x.nodeName !== 'w:rPr'))) return;
    const run = seg.run;
    const content = kids(run).filter((x) => x.nodeName !== 'w:rPr');
    const i = content.indexOf(seg.node);
    const k = off - seg.start;
    const r2 = run.cloneNode(true) as Element;
    const content2 = kids(r2).filter((x) => x.nodeName !== 'w:rPr');
    if (k === 0) {
      content.slice(i).forEach((x) => run.removeChild(x));
      content2.slice(0, i).forEach((x) => r2.removeChild(x));
    } else {
      content.slice(i + 1).forEach((x) => run.removeChild(x));
      content2.slice(0, i).forEach((x) => r2.removeChild(x));
      setT(seg.node, seg.text.slice(0, k));
      setT(content2[i], seg.text.slice(k));
    }
    run.parentNode!.insertBefore(r2, run.nextSibling);
  }

  // replace [a,b) of the paragraph text with nodes
  replaceRange(p: Element, a: number, b: number, nodes: Node[]) {
    this.boundary(p, a);
    this.boundary(p, b);
    const segs = this.segments(p);
    const inside = [...new Set(segs.filter((s) => s.start >= a && s.start + s.text.length <= b && s.text.length).map((s) => s.run))];
    let anchor: Element | null = inside[0] ?? segs.find((s) => s.start >= b)?.run ?? null;
    let parent: Node = anchor?.parentNode ?? p;
    if (!anchor) {
      const last = segs[segs.length - 1]?.run;
      if (last) {
        parent = last.parentNode!;
        anchor = last.nextSibling as Element | null;
      }
    }
    for (const n of nodes) parent.insertBefore(n, anchor);
    for (const r of inside) r.parentNode!.removeChild(r);
  }

  // rPr in effect at offset (falls back to paragraph mark)
  rPrAt(p: Element, off: number): Element | null {
    const segs = this.segments(p);
    const s = segs.find((x) => x.start <= off && off < x.start + x.text.length) ?? segs[segs.length - 1];
    const r = s ? kid(s.run, 'w:rPr') : undefined;
    if (r) return r;
    const pPr = kid(p, 'w:pPr');
    return (pPr && kid(pPr, 'w:rPr')) || null;
  }

  // ---- run creation ----

  rPr(base: Element | null, rtl: boolean, fmt: Fmt = {}): Element {
    const r = base ? (base.cloneNode(true) as Element) : this.el('w:rPr');
    for (const x of kids(r)) if (['w:ins', 'w:del', 'w:rPrChange', 'w:vanish', 'w:strike', 'w:moveFrom', 'w:moveTo'].includes(x.nodeName)) r.removeChild(x);
    setProp(this, r, 'w:rtl', rtl ? {} : null);
    if (fmt.u) setProp(this, r, 'w:u', { 'w:val': 'single' });
    if (fmt.b) {
      setProp(this, r, 'w:b', {});
      setProp(this, r, 'w:bCs', {});
    }
    return r;
  }

  runs(text: string, base: Element | null, fmt: Fmt = {}): Element[] {
    const out: Element[] = [];
    const lines = text.split(/\r?\n/);
    lines.forEach((line, li) => {
      if (li > 0) out.push(this.el('w:r', {}, [this.rPr(base, true, fmt), this.el('w:br')]));
      for (const seg of bidiSegments(line)) {
        if (!seg.text) continue;
        const t = this.el('w:t');
        t.setAttribute('xml:space', 'preserve');
        t.appendChild(this.doc.createTextNode(seg.text));
        out.push(this.el('w:r', {}, [this.rPr(base, seg.rtl, fmt), t]));
      }
    });
    return out;
  }

  // new paragraph with pPr cloned from ref (no numbering / section)
  para(ref: Element | null, nodes: Node[] = [], opts: { pageBreakBefore?: boolean; center?: boolean } = {}): Element {
    const p = this.el('w:p');
    const src = ref && kid(ref, 'w:pPr');
    const pPr = src ? (src.cloneNode(true) as Element) : this.el('w:pPr', {}, [this.el('w:bidi')]);
    for (const x of kids(pPr)) if (['w:numPr', 'w:sectPr', 'w:pPrChange', 'w:pageBreakBefore', 'w:framePr'].includes(x.nodeName)) pPr.removeChild(x);
    setOrdered(this, pPr, 'w:bidi', {}, PPR_ORDER);
    if (opts.center) setOrdered(this, pPr, 'w:jc', { 'w:val': 'center' }, PPR_ORDER);
    if (opts.pageBreakBefore) setOrdered(this, pPr, 'w:pageBreakBefore', {}, PPR_ORDER);
    p.appendChild(pPr);
    for (const n of nodes) p.appendChild(n);
    return p;
  }

  // ---- images ----

  image(img: DocxImage, maxWcm: number, maxHcm: number): Element | null {
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/gif': 'gif', 'image/webp': 'webp' }[img.contentType.toLowerCase()];
    if (!ext) {
      console.warn('docx: unsupported image type', img.contentType);
      return null;
    }
    const n = ++this.nImg;
    const target = `media/fill-${n}.${ext}`;
    this.files[`word/${target}`] = img.data;
    const rid = `rIdFill${n}`;
    const rel = this.rels.createElementNS(PKG_REL_NS, 'Relationship');
    rel.setAttribute('Id', rid);
    rel.setAttribute('Type', REL_IMAGE);
    rel.setAttribute('Target', target);
    this.rels.documentElement!.appendChild(rel);
    const root = this.types.documentElement!;
    if (!kids(root, 'Default').some((d) => d.getAttribute('Extension')?.toLowerCase() === ext)) {
      const d = this.types.createElementNS(CT_NS, 'Default');
      d.setAttribute('Extension', ext);
      d.setAttribute('ContentType', ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`);
      root.insertBefore(d, root.firstChild);
    }
    const { w, h } = imageSize(img.data) ?? { w: 400, h: 300 };
    const scale = Math.min((maxWcm * 360000) / (w * 9525), (maxHcm * 360000) / (h * 9525), 1e9);
    const cx = Math.round(w * 9525 * scale);
    const cy = Math.round(h * 9525 * scale);
    const id = ++this.nDocPr;
    const xml =
      `<w:r xmlns:w="${W_NS}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="${R_NS}">` +
      `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="${id}" name="Picture ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="fill-${n}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    const frag = new DOMParser().parseFromString(xml, 'text/xml').documentElement!;
    return this.doc.importNode(frag, true) as Element;
  }
}

function setT(t: Element, s: string) {
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(t.ownerDocument!.createTextNode(s));
  t.setAttribute('xml:space', 'preserve');
}

// set or remove a property child, keeping schema order
function setOrdered(d: Docx, parent: Element, name: string, attrs: Record<string, string> | null, order: string[]) {
  for (const x of kids(parent, name)) parent.removeChild(x);
  if (!attrs) return;
  const rank = order.indexOf(name);
  const before = kids(parent).find((x) => order.indexOf(x.nodeName) > rank) ?? null;
  parent.insertBefore(d.el(name, attrs), before);
}
const setProp = (d: Docx, rPr: Element, name: string, attrs: Record<string, string> | null) => setOrdered(d, rPr, name, attrs, RPR_ORDER);

// pixel size of png / jpeg / gif / webp
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: dv.getUint32(16), h: dv.getUint32(20) };
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49) return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      i += 2 + dv.getUint16(i + 2);
    }
    return null;
  }
  if (b.length > 30 && strFromU8(b.subarray(0, 4)) === 'RIFF' && strFromU8(b.subarray(8, 12)) === 'WEBP') {
    const kind = strFromU8(b.subarray(12, 16));
    if (kind === 'VP8X') return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (kind === 'VP8L') {
      const v = dv.getUint32(21, true);
      return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
  }
  return null;
}
