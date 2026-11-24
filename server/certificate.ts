import { CERT_LOGOS, FONT_CSS } from '../shared/pdf/assets.gen';
import type { CertData, CertTemplate } from '../shared/certificates';

export type CertInput = {
  template: CertTemplate;
  number: string;
  issueDate: string; // dd/mm/yyyy
  data: CertData;
  inspectorName: string;
  engineerName: string;
  images: { inspectorSignature?: string | null; engineerSignature?: string | null; stamp?: string | null };
};

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const img = (src: string | null | undefined, cls: string) => (src ? `<img class="${cls}" src="${esc(src)}" alt="">` : '');

const GENERAL = (standard: string) => [
  'אם לאחר בדיקת המעבדה תותקן תקרה תותבת, יש להזמין את המעבדה לבדיקה חוזרת, לרבות בדיקת תוכניות – באחריות בעל העסק / המבנה.',
  `באחריות בעל העסק / מבנה לבצע תחזוקה שוטפת למערכת עפ"י ${standard.replace(/חלק \d+/, 'חלק 11')}.`,
  'כל שינוי מבני או מערכתי יחייב הוצאת אישור מעבדה חדש.',
  'חובה לשמור על תיק המערכת שהוגש וכל שינוי במערכת או במבנה - יש ליידע במיידי.',
  'ממצאי הבדיקה תקפים ליום הבדיקה בלבד.',
];
const DECL = [
  'הבדיקה שתוצאותיהן נכללות בתעודה זו בוצעו בהתאם לתקנים הרשמים.',
  'התוצאות מתייחסות לפריטים שנבדקו ואין ליחסן לאתרים אחרים של המזמין.',
  'יש להתייחס למסמך במלואו ואין להעתיק ממנו למסמכים אחרים.',
  'פרטים ונתונים על הפריטים שנבדקו הם כפי שנמסרו ע"י המזמין, או בא כוחו.',
  'כל ציוד הבדיקה המשמש לביצוע הבחינות מכויל במעבדה מוסמכת.',
  'השימוש בסמליל הרשות מתייחס רק לבחינות שבוצעו ומפורטות במסמך היקף ההסמכה של המעבדה.',
  'הרשות הלאומית להסמכת מעבדות אינה אחראית לתוצאות הבחינה ואין ההסמכה מהווה אישור לפריט שנבחן.',
];

const CSS = `
@page { size: A4; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: 'Heebo', sans-serif; font-size: 9.5pt; line-height: 1.35; color: #111 }
.page { width: 210mm; height: 297mm; padding: 9mm 10mm 7mm; position: relative; break-after: page; border: 2.5px solid #1d3c8f; outline: 1px solid #1d3c8f; outline-offset: -5px; overflow: hidden; display: flex; flex-direction: column }
.page:last-child { break-after: auto }
.body { flex: 1; min-height: 0; overflow: hidden; padding-bottom: 2mm }
header { direction: ltr; display: flex; align-items: center; justify-content: space-between }
.logo { height: 22mm } .israc { height: 25mm }
.brand { font-size: 26pt; font-weight: 500; color: #1d3c8f } .red { color: #d0202a; font-weight: 700 }
.sub { direction: ltr; display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 1.5px solid #1d3c8f; padding-bottom: 2mm; margin-top: 1mm }
.mail { color: #1d3c8f; text-decoration: underline; font-weight: 600 }
.doc { font-size: 9.5pt; direction: rtl }
.ver { direction: rtl; border-collapse: collapse; font-size: 8pt } .ver td { border: 1px solid #555; padding: 0.5mm 2mm }
.num { text-align: left; font-weight: 700; font-size: 11pt; color: #1d3c8f }
h1 { text-align: center; font-size: 14pt; text-decoration: underline; margin: 0 0 2.5mm }
h1 bdi { font-weight: 800 }
table.grid { width: 100%; border-collapse: collapse; margin-bottom: 2mm }
.grid th, .grid td { border: 1px solid #333; padding: 0.7mm 2mm; text-align: start; vertical-align: top; white-space: pre-wrap }
.grid th { width: 22%; font-weight: 700; white-space: nowrap }
.band th { background: #c9daf0 }
.concl { border: 1px solid #333; padding: 2mm 3mm; margin: 4mm 0 }
.concl u { font-weight: 700 } .big { font-size: 13pt; font-weight: 800; text-decoration: underline }
ul, ol.def { margin: 1mm 0; padding-inline-start: 6mm; line-height: 1.5; font-size: 10pt }
.body > div > p { margin: 1.5mm 0 }
.two { display: grid; grid-template-columns: 1fr 1.15fr; border: 1px solid #333; font-size: 7.5pt; line-height: 1.3; margin-top: 3mm }
.two > div { padding: 2mm 3mm } .two > div + div { border-inline-start: 1px solid #333 }
.two p { margin: 0.5mm 0 }
.sign { width: 100%; border-collapse: collapse; margin-top: 5mm }
.sign td, .sign th { border: 1px solid #333; padding: 1.5mm; height: 20mm; vertical-align: middle; text-align: center; white-space: nowrap }
.sign th { width: 12% }
.sigimg { height: 16mm; max-width: 45mm; object-fit: contain }
.signwrap { position: relative }
.stamp { position: absolute; left: 2mm; top: 0; width: 36mm; mix-blend-mode: multiply; transform: rotate(-8deg) }
footer { border-top: 1.5px solid #1d3c8f; padding-top: 2mm; display: flex; justify-content: space-between; font-weight: 700; color: #1d3c8f }
`;

// moves overflowing blocks to a continuation page, then numbers the pages
const PAGINATE = `window.__ready = document.fonts.ready.then(() => {
  const all = () => [...document.querySelectorAll('.page')];
  for (let i = 0; i < all().length; i++) {
    const p = all()[i];
    const body = p.querySelector('.body');
    while (body.scrollHeight > body.clientHeight + 1 && body.children.length > 1) {
      let next = p.nextElementSibling;
      if (!next || !next.classList.contains('cont')) {
        next = p.cloneNode(true);
        next.classList.add('cont');
        next.querySelector('.body').replaceChildren();
        p.after(next);
      }
      next.querySelector('.body').prepend(body.lastElementChild);
    }
  }
  const n = all().length;
  all().forEach((p, i) => (p.querySelector('.pg').textContent = (i + 1) + ' מתוך ' + n));
  document.querySelectorAll('.pages').forEach((e) => (e.textContent = n));
});`;

/** Certificate pages, as approved from the 1220 sample. */
export function renderCertificateHtml(c: CertInput): string {
  const d = c.data;
  const t = c.template;
  const kv = (k: string, v: string) => `<th>${esc(k)}:</th><td>${esc(v)}</td>`;
  const head = (page: number) => `
<header>
  <img class="logo" src="${CERT_LOGOS.elco}" alt="ELCO">
  <div class="brand"><span class="red">אלקו</span> מעבדות בע"מ</div>
  <img class="israc" src="${CERT_LOGOS.israc}" alt="ISRAC">
</header>
<div class="sub">
  <span class="mail">Elco.labs22@gmail.com</span>
  <b class="doc">${esc(t.title)}</b>
  <table class="ver"><tr><td>מהדורה</td><td>07</td></tr><tr><td>דף</td><td class="pg">${page} מתוך 2</td></tr></table>
</div>
<div class="num">${esc(c.number.replace(/^\D+/, ''))}</div>`;
  const foot = `<footer><span>רח' דיר אללתין 1 - ריינה</span><span>052-9554441</span><span>04-9999009</span></footer>`;
  const party = (label: string, p: CertData['designer']) =>
    `<tr><th>${esc(label)}:</th><td>${esc(p.name)}</td><td>${p.idNo ? `ת.ז: ${esc(p.idNo)}` : ''}</td><td>טלפון: <bdi dir="ltr">${esc(p.phone)}</bdi></td></tr>`;

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(c.number)}</title><style>${FONT_CSS}${CSS}</style></head><body>
<section class="page">
${head(1)}
<div class="body">
<h1>תעודת בדיקה מס' : <bdi dir="ltr">${esc(c.number)}</bdi></h1>
<table class="grid">
<tr>${kv('תאריך הבדיקה', d.testDate)}${kv('תאריך הפצה', c.issueDate)}</tr>
<tr>${kv('ייעוד המבנה', d.buildingUse)}${kv('שם האתר', d.siteName)}</tr>
<tr>${kv('כתובת האתר', d.address)}${kv("מס' הסכם", d.agreement)}</tr>
</table>
<table class="grid">
<tr>${kv('תיאור מבנה', d.description)}</tr>
<tr>${kv('חללים מוגנים ע"י המערכת', d.protectedSpaces)}</tr>
<tr>${kv('חללים אינם מוגנים', d.unprotectedSpaces)}</tr>
</table>
<table class="grid"><tr><th>הוצגו דרישות כבאות</th><td>${esc(d.fireDeptShown)}</td>${kv("מס' תיק", d.fireDeptFile)}${kv("מס' סימוכין", d.fireDeptRef)}</tr></table>
<table class="grid">
<tr>${kv('גוש', d.gush)}${kv('שטח המבנה (מ"ר)', d.area)}</tr>
<tr>${kv('חלקה', d.helka)}${kv('גובה המבנה (מטר)', d.height)}</tr>
<tr>${kv('מגרש', d.migrash)}<th></th><td></td></tr>
</table>
<table class="grid"><tr><th style="width:45%">רמת סיכון שנקבעה ע"י המתכנן ולפי התקן:</th><td>${esc(d.risk)}</td></tr></table>
<table class="grid">
<tr>${kv('הרכזת מחוברת לחייגן בטלפון', d.dialerPhone)}${kv('מחייג ל', d.dialsTo)}</tr>
<tr class="band">${kv('סוג הרכזת', d.panelType)}${kv('מיקום הרכזת', d.panelLocation)}</tr>
</table>
<table class="grid">
${d.equipment.map((e) => `<tr><th>${esc(e.label)}:</th><td><bdi dir="ltr">${esc(e.model)}</bdi></td><th style="width:12%">${e.qty ? 'כמות:' : ''}</th><td style="width:10%">${esc(e.qty)}</td></tr>`).join('') || '<tr><th>ציוד:</th><td colspan="3"></td></tr>'}
</table>
<table class="grid">
${party(`שם מתכנן ${t.systemName}`, d.designer)}
${party('שם הקבלן המבצע', d.contractor)}
${party('הבדיקה נערכה בליווי', d.escort)}
</table>
</div>
${foot}
</section>

<section class="page">
${head(2)}
<div class="body">
<table class="grid" style="margin-top:3mm">
<tr class="band"><th colspan="3" style="text-align:center">לוחות חשמל</th></tr>
<tr><th>תיאור החלל</th><th>ניתוק ממקור הזנה</th><th>מוגן ע"י גלאים</th></tr>
${(d.boards.length ? d.boards : [{ space: '', cutoff: '', protectedBy: '' }]).map((b) => `<tr><td>${esc(b.space) || '&nbsp;'}</td><td>${esc(b.cutoff)}</td><td>${esc(b.protectedBy)}</td></tr>`).join('')}
</table>
<div class="concl">
<u>מסקנה:</u><br>המערכת נבדקה עפ"י התקנה.<br>
המערכת <span class="big">${d.fit ? 'מתאימה' : 'אינה מתאימה'}</span> לדרישות ${esc(t.standard)} כמפורט מטה.
</div>
<div><p><b><u>רשימת ליקויים ע"י המעבדה : ${d.defects.length ? '' : 'אין.'}</u></b></p>
${d.defects.length ? `<ol class="def">${d.defects.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}</div>
<div><p><u>הערות כלליות:</u></p>
<ul>${GENERAL(t.standard).map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>
<div class="two">
  <div><b>תפוצת חובה:</b><p><b>1. המזמין.</b></p><p><b>2. כבאות והצלה לישראל</b></p>
  <p>- כל הפצה נוספת של התעודה – על פי אישור בכתב של המזמין.</p>
  <p>- התעודה מכילה <span class="pages">2</span> דפים ואין להשתמש בה אלא במלואה.</p>
  <p><b>תעודה לאישור מעבדה ל${esc(t.systemName)}</b></p></div>
  <div><b><u>הצהרות:</u></b>${DECL.map((x) => `<p>- ${esc(x)}</p>`).join('')}</div>
</div>
<div class="signwrap">
<table class="sign">
<tr>
  <th>שם הבודק:</th><td>${esc(c.inspectorName)}<br>${img(c.images.inspectorSignature, 'sigimg')}</td>
  <th>שם המאשר ותפקידו:</th><td>${esc(c.engineerName)}<br>${esc(d.engineerRole)}</td>
  <th>חתימה:</th><td>${img(c.images.engineerSignature, 'sigimg')}</td>
</tr>
</table>
${img(c.images.stamp, 'stamp')}
</div>
</div>
${foot}
</section>
<script>${PAGINATE}</script>
</body></html>`;
}
