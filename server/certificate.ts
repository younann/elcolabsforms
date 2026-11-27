import { CERT_LOGOS, FONT_CSS } from '../shared/pdf/assets.gen';
import type { CertData, CertTemplate } from '../shared/certificates';

export type CertInput = {
  template: CertTemplate;
  number: string;
  issueDate: string; // dd/mm/yyyy
  data: CertData;
  inspectorName: string;
  engineerName: string;
  adminName: string;
  images: { inspectorSignature?: string | null; engineerSignature?: string | null; adminSignature?: string | null; stamp?: string | null; matrix?: string[] };
};

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const img = (src: string | null | undefined, cls: string) => (src ? `<img class="${cls}" src="${esc(src)}" alt="">` : '');

const CEILING = 'אם לאחר בדיקת המעבדה תותקן תקרה תותבת, יש להזמין את המעבדה לבדיקה חוזרת, לרבות בדיקת תוכניות – באחריות בעל העסק / המבנה.';
const GENERAL = (t: CertTemplate) =>
  [
    t.layout === 'detectors' && 'ציוד מתואם לתקן 1220 חלק 5.',
    (t.layout === 'detection' || t.layout === 'detectors') && CEILING,
    `באחריות בעל העסק / מבנה לבצע תחזוקה שוטפת למערכת עפ"י ${t.layout === 'detectors' ? 'ת"י 1220 חלק 11' : t.layout === 'detection' ? t.standard.replace(/חלק \d+/, 'חלק 11') : t.standard}.`,
    'כל שינוי מבני או מערכתי יחייב הוצאת אישור מעבדה חדש.',
    'חובה לשמור על תיק המערכת שהוגש וכל שינוי במערכת או במבנה - יש ליידע במיידי.',
    t.layout === 'extinguish' && 'באחריות בעל העסק לבצע פעולות לאחר פריקת המחולל כיבוי לפי הנחיות היצרן המערכת.',
    'ממצאי הבדיקה תקפים ליום הבדיקה בלבד.',
    t.layout === 'detectors' && 'הבדיקה בוצעה שלא בהסמכת הרשות הלאומית להסמכת מעבדות.',
  ].filter((x): x is string => !!x);
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
.sign th { width: 10% }
.sigimg { height: 16mm; max-width: 45mm; object-fit: contain }
.signwrap { position: relative }
.stamp { position: absolute; left: 2mm; top: 0; width: 36mm; mix-blend-mode: multiply; transform: rotate(-8deg) }
.spaces th, .spaces td { text-align: center; width: auto; white-space: normal }
.ihead { width: 100%; border-collapse: collapse; margin-bottom: 3mm }
.ihead td { border: 1px solid #333; padding: 1mm 2mm; text-align: center; vertical-align: middle }
.ihead .ttl { font-weight: 700; font-size: 11pt; line-height: 1.4 }
.matrix { width: 100%; border-collapse: collapse; margin-bottom: 3mm; font-size: 8.5pt }
.matrix th, .matrix td { border: 1px solid #333; padding: 0.7mm 1.5mm; text-align: center }
.matrix td:first-child, .matrix th:first-child { text-align: start }
h2 { font-size: 11pt; margin: 3mm 0 1.5mm; text-decoration: underline }
.ifoot { font-size: 8pt; line-height: 1.4; padding-top: 2mm }
.matrix-img { display: block; max-width: 100%; max-height: 205mm; margin: 2mm auto; object-fit: contain; border: 1px solid #999 }
.end { text-align: center; font-weight: 700; margin-top: 4mm }
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

const kv = (k: string, v: string) => `<th>${esc(k)}:</th><td>${esc(v)}</td>`;
const doc = (title: string, pages: string) =>
  `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${FONT_CSS}${CSS}</style></head><body>${pages}<script>${PAGINATE}</script></body></html>`;

function detectionMid(d: CertData) {
  return `<table class="grid">
<tr>${kv('תיאור מבנה', d.description)}</tr>
<tr>${kv('חללים מוגנים ע"י המערכת', d.protectedSpaces)}</tr>
<tr>${kv('חללים אינם מוגנים', d.unprotectedSpaces)}</tr>
</table>
${commonMid(d)}
<table class="grid">
<tr>${kv('הרכזת מחוברת לחייגן בטלפון', d.dialerPhone)}${kv('מחייג ל', d.dialsTo)}</tr>
<tr class="band">${kv('סוג הרכזת', d.panelType)}${kv('מיקום הרכזת', d.panelLocation)}</tr>
</table>
<table class="grid">
${d.equipment.map((e) => `<tr><th>${esc(e.label)}:</th><td><bdi dir="ltr">${esc(e.model)}</bdi></td><th style="width:12%">${e.qty ? 'כמות:' : ''}</th><td style="width:10%">${esc(e.qty)}</td></tr>`).join('') || '<tr><th>ציוד:</th><td colspan="3"></td></tr>'}
</table>`;
}

function conclusion(d: CertData, t: CertTemplate) {
  return t.layout === 'detectors'
    ? `<div class="concl"><u>מסקנה:</u><br>המערכת נבדקה עפ"י התקנה.<br>התקנת גלאים <span class="big">${d.fit ? 'מתאימה' : 'אינה מתאימה'}</span> לדרישות ${esc(t.standard)}.</div>`
    : `<div class="concl"><u>מסקנה:</u><br>המערכת נבדקה עפ"י התקנה.<br>המערכת <span class="big">${d.fit ? 'מתאימה' : 'אינה מתאימה'}</span> לדרישות ${esc(t.standard)} כמפורט מטה.</div>`;
}

function detectorsMid(d: CertData, t: CertTemplate) {
  const rows = d.detectorRows.length ? d.detectorRows : [{ model: '', maker: '', location: '', battery: '' }];
  return `<table class="grid">
<tr>${kv('מקום הבדיקה', d.testPlace)}</tr>
<tr>${kv('מספר קומות', d.floors)}</tr>
<tr>${kv('כמות הגלאים', d.detectorQty)}</tr>
<tr>${kv("מס' דירות בבניין", d.apartments)}</tr>
<tr>${kv("מס' דירות שהותקנו גלאים עצמאיים", d.apartmentsWithDetectors)}</tr>
<tr>${kv('מיקום הגלאים שנבדקו', d.detectorLocations)}</tr>
<tr>${kv('גוש', d.gush)}</tr>
<tr>${kv('חלקה', d.helka)}</tr>
<tr>${kv('מגרש', d.migrash)}</tr>
</table>
<p><b><u>פרטי גלאי עצמאי:</u></b></p>
<table class="grid spaces">
<tr class="band"><th>דגם</th><th>מתוצרת חברת</th><th>מיקום התקנת הגלאי</th><th>דגם סוללת הגלאי</th></tr>
${rows.map((r) => `<tr><td><bdi dir="ltr">${esc(r.model)}</bdi></td><td><bdi dir="ltr">${esc(r.maker)}</bdi></td><td>${esc(r.location)}</td><td><bdi dir="ltr">${esc(r.battery)}</bdi></td></tr>`).join('')}
</table>
${conclusion(d, t)}`;
}

function commonMid(d: CertData) {
  return `<table class="grid"><tr><th>הוצגו דרישות כבאות</th><td>${esc(d.fireDeptShown)}</td>${kv("מס' תיק", d.fireDeptFile)}${kv("מס' סימוכין", d.fireDeptRef)}</tr></table>
<table class="grid">
<tr>${kv('גוש', d.gush)}${kv('שטח המבנה (מ"ר)', d.area)}</tr>
<tr>${kv('חלקה', d.helka)}${kv('גובה המבנה (מטר)', d.height)}</tr>
<tr>${kv('מגרש', d.migrash)}<th></th><td></td></tr>
</table>
<table class="grid"><tr><th style="width:45%">רמת סיכון שנקבעה ע"י המתכנן ולפי התקן:</th><td>${esc(d.risk)}</td></tr></table>`;
}

function extinguishMid(d: CertData) {
  const spaces = d.spaces.length ? d.spaces : [{ desc: '', location: '', dims: '', volume: '', agent: '', container: '', containerQty: '' }];
  return `${commonMid(d)}
<table class="grid">
<tr>${kv('הרכזת מחוברת לחייגן בטלפון', d.dialerPhone)}${kv('מחייג לאחראי בשם', d.dialsTo)}</tr>
<tr>${kv('טלפון האחראי', d.dialsToPhone)}<th></th><td></td></tr>
<tr class="band">${kv('סוג הרכזת', d.panelType)}${kv('מיקום הרכזת', d.panelLocation)}</tr>
</table>
<table class="grid">
<tr>${kv('סוג מערכת הכיבוי', d.systemType)}${kv('סוג הגלאים', d.detectorType)}</tr>
<tr>${kv('כמות הגלאים', d.detectorQty)}<th></th><td></td></tr>
</table>
<p><b><u>חללים מוגנים:</u></b></p>
<table class="grid spaces">
<tr class="band"><th>סיד'</th><th>תיאור החלל המוגן</th><th>מיקום</th><th>מידות</th><th>נפח החלל</th><th>כמות חומר הכיבוי</th><th>סוג מיכל</th><th>כמות המכלים</th></tr>
${spaces.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.desc)}</td><td>${esc(x.location)}</td><td><bdi dir="ltr">${esc(x.dims)}</bdi></td><td>${esc(x.volume)}</td><td>${esc(x.agent)}</td><td><bdi dir="ltr">${esc(x.container)}</bdi></td><td>${esc(x.containerQty)}</td></tr>`).join('')}
</table>`;
}

/** 536 integration certificate, as in the INT sample. */
function renderIntegrationHtml(c: CertInput): string {
  const d = c.data;
  const t = c.template;
  const [, mm, yyyy] = c.issueDate.split('/');
  const head = `
<table class="ihead">
<tr><td colspan="2" rowspan="1" style="width:28%"><img class="logo" src="${CERT_LOGOS.elco}" alt="ELCO"></td>
<td colspan="2" class="ttl">תעודת בדיקה<br>משטר הפעלות של יועץ בטיחות – בהתאמה לדרישות NFPA4<br>רשימת תיוג לבדיקת אינטגרציה לפי הוראת מכ"ר פרק 500 הוראה 536</td>
<td style="width:22%"><img class="israc" src="${CERT_LOGOS.israc}" alt="ISRAC"></td></tr>
<tr><td><b>${esc(c.number.replace(/^\D+/, ''))}</b></td><td>מס' תעודה</td><td>מייל: <span dir="ltr">elco.labs22@gmail.com</span></td><td>תאריך: <bdi dir="ltr">${esc(`${mm}/${yyyy}`)}</bdi></td><td rowspan="2"><b>דף מספר <span class="pg">1</span></b></td></tr>
<tr><td>T-20005-3</td><td>טופס מס'</td><td>מס' טלפון: <span dir="ltr">0529554441</span></td><td>מהדורה: 04</td></tr>
</table>`;
  const foot = `<div class="ifoot">העותקים המאושרים היחידים של מסמך זה הם אלה הנמצאים על מחשב מעבדת אלקו ועותק המקור השמור בספריית אלקו QA. כל שאר העותקים אינם מבוקרים והם בתוקף ליום בו הודפסו בלבד. הודפס ב-${esc(c.issueDate)}</div>`;
  const page = (body: string) => `<section class="page">${head}<div class="body">${body}</div>${foot}</section>`;
  const fitWord = d.fit ? 'מתאימה' : 'לא מתאימה';
  const yesNo = (x: string) => esc(x) || '&nbsp;';

  const p1 = page(`
<table class="grid">
<tr class="band"><th colspan="4">פרטי הלקוח - הזמנה</th></tr>
<tr>${kv('שם המזמין', d.customerName)}${kv('שם אתר', d.siteName)}</tr>
<tr>${kv("מס' סימוכין", d.fireDeptRef)}${kv("מס' תיק", d.fireDeptFile)}</tr>
<tr>${kv('שם מתכנן', d.designer.name)}${kv("מס' הסכם", d.agreement)}</tr>
<tr>${kv('כתובת אתר', d.address)}${kv("מס' הלקוח", d.clientNo)}</tr>
<tr><th>גוש / חלקה / מגרש:</th><td>${esc([d.gush, d.helka, d.migrash].join(' / '))}</td>${kv("מס' הזמנה", d.orderNo)}</tr>
</table>
<table class="grid">
<tr class="band"><th colspan="6">מהות הבדיקה</th></tr>
<tr><td colspan="6"><b>בדיקת משטר הפעלות מערכות חירום בהתאם לתקן 1220 חלק 3 והוראת מכ"ר 536 ${d.description ? `– ${esc(d.description)}` : 'למבנה חדש / ביקורת תקופתית'}.</b></td></tr>
<tr>${kv("מס' תעודה", c.number.replace(/^\D+/, ''))}${kv('תאריך בדיקה', d.testDate)}${kv("מס' תעודה קודמת", d.previousCert)}</tr>
</table>
<h2>פרטי האתר</h2>
<table class="grid">
<tr>${kv('סיווג הבניין לפי גובה', d.heightClass)}</tr>
<tr>${kv('פירוט קומות', d.floors)}</tr>
<tr>${kv('ייעוד המבנה', d.buildingUse)}</tr>
<tr>${kv("מס' חייגן ראשי", d.dialerPhone)}</tr>
</table>
<div class="concl">מסקנה להתאמת הוראות ${esc(t.standard)}.<br>המערכת שנבדקה נמצאה <span class="big">${fitWord}</span> לדרישות ${esc(t.standard)}.</div>
<div class="signwrap">
<table class="sign">
<tr><th>שם הבודק:</th><td>${esc(c.inspectorName)}<br>${img(c.images.inspectorSignature, 'sigimg')}</td>
<th>${esc(d.engineerRole)}:</th><td>${esc(c.engineerName)}</td>
<th>חתימה:</th><td>${img(c.images.engineerSignature, 'sigimg')}</td>
<th>אישור המשרד:</th><td>${esc(c.adminName)}<br>${img(c.images.adminSignature, 'sigimg')}</td></tr>
</table>
${img(c.images.stamp, 'stamp')}
</div>
<div class="two">
  <div><b><u>תפוצת חובה</u></b><p>1. המזמין</p><p>2. שירותי כבאות. כל הפצה נוספת של התעודה – על פי אישור בכתב של המזמין.</p>
  <p>- התעודה מכילה <span class="pages">4</span> דפים ואין להשתמש בה אלא במלואה.</p></div>
  <div><b><u>הצהרות:</u></b><p>- הבדיקות שתוצאותיהן נכללות בתעודה בוצעו בהתאם לתקנים הישימים ובכללם ת"י 17020 ומכ"ר 536.</p>${DECL.map((x) => `<p>- ${esc(x)}</p>`).join('')}</div>
</div>`);

  const p2 = page(`
<h2>1. רשימת מסמכים:</h2>
<table class="matrix">
<tr class="band"><th>סוג התעודה</th><th>מעבדה מבצעת</th><th>מס' תעודת הבדיקה</th><th>מתאים / לא מתאים</th></tr>
${d.docs.map((x) => `<tr><td><b>${esc(x.type)}</b></td><td>${esc(x.lab)}</td><td>${esc(x.certNo)}</td><td>${yesNo(x.fit)}</td></tr>`).join('') || '<tr><td colspan="4">&nbsp;</td></tr>'}
</table>
<h2>2. מערכות משתתפות בבדיקת משטר ההפעלות ימולא בהתאם למערכות המותקנות באתר.</h2>
<table class="matrix">
${d.systems.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td style="width:20%">${yesNo(x.value)}</td></tr>`).join('') || '<tr><td colspan="2">&nbsp;</td></tr>'}
</table>`);

  const p3 = page(`
<h2>3. בעמדת כבאים מותקנים:</h2>
<table class="matrix">
<tr class="band"><th>מס'</th><th>מערכות</th><th>קיים / לא קיים</th><th>שילוט</th><th>מתאים / לא מתאים / לא רלוונטי</th></tr>
${d.panel.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${yesNo(x.exists)}</td><td>${yesNo(x.sign)}</td><td>${yesNo(x.fit)}</td></tr>`).join('')}
</table>
<div><h2>4. ליקויים ע"י המעבדה : ${d.defects.length ? '' : 'אין.'}</h2>
${d.defects.length ? `<ol class="def">${d.defects.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}</div>
<div><p><b><u>הערות ע"י המעבדה:</u></b></p>
<ul>${GENERAL(t).map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>`);

  const scen = d.scenarios.map(
    (x, i) => `<div>
<table class="matrix">
<tr><th colspan="${x.columns.length + 2}">טבלה מס' ${i + 1} – מיקום הבדיקה: ${esc(x.location)}${x.detail ? ` – ${esc(x.detail)}` : ''}</th></tr>
${x.addresses ? `<tr><td colspan="${x.columns.length + 2}">כתובת התקנים: ${esc(x.addresses)}</td></tr>` : ''}
<tr class="band"><th>מס'</th><th>התקני התרעה / פעולות המערכת<br><small>מופעל (+), לא מתאים (למ), לא מופעל (-), לא חל (לח)</small></th>${x.columns.map((col) => `<th>${esc(col)}</th>`).join('')}</tr>
${x.rows.map((r, ri) => `<tr><td>${ri + 1}</td><td><b>${esc(r.action)}</b></td>${r.cells.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}
</table></div>`,
  );
  const end = '<p class="end">****סוף תעודה ****</p>';
  const matrix = c.images.matrix ?? [];
  const p4 = page(`<h2>5. ממצאי משטר הפעלות:</h2>${scen.join('') || '<p>&nbsp;</p>'}${matrix.length ? '' : end}`);
  // one scanned matrix page per certificate page
  const p5 = matrix
    .map((src, i) =>
      page(
        `${i ? '' : '<h2>6. להלן פירוט חלקי המערכות שנבדקו במהלך בדיקת משטר ההפעלות אל מול טבלת משטר ההפעלות:</h2>'}<img class="matrix-img" src="${esc(src)}" alt="">${i === matrix.length - 1 ? end : ''}`,
      ),
    )
    .join('');

  return doc(c.number, p1 + p2 + p3 + p4 + p5);
}

/** Certificate pages, as approved from the 1220 sample. */
export function renderCertificateHtml(c: CertInput): string {
  if (c.template.layout === 'integration') return renderIntegrationHtml(c);
  const d = c.data;
  const t = c.template;
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

  return doc(
    c.number,
    `<section class="page">
${head(1)}
<div class="body">
<h1>תעודת בדיקה מס' : <bdi dir="ltr">${esc(c.number)}</bdi>${d.repeatOf ? ` <small>חוזרת ל${esc(d.repeatOf)}</small>` : ''}</h1>
<table class="grid">
<tr>${kv('תאריך הבדיקה', d.testDate)}${kv('תאריך הפצה', c.issueDate)}</tr>
<tr>${kv('ייעוד המבנה', d.buildingUse)}${kv('שם האתר', d.siteName)}</tr>
<tr>${kv('כתובת האתר', d.address)}${kv("מס' הסכם", d.agreement)}</tr>
</table>
${t.layout === 'detection' ? detectionMid(d) : t.layout === 'detectors' ? detectorsMid(d, t) : extinguishMid(d)}
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
${t.layout !== 'detection' && !d.boards.length ? '' : `<table class="grid" style="margin-top:3mm">
<tr class="band"><th colspan="3" style="text-align:center">לוחות חשמל</th></tr>
<tr><th>תיאור החלל</th><th>ניתוק ממקור הזנה</th><th>מוגן ע"י גלאים</th></tr>
${(d.boards.length ? d.boards : [{ space: '', cutoff: '', protectedBy: '' }]).map((b) => `<tr><td>${esc(b.space) || '&nbsp;'}</td><td>${esc(b.cutoff)}</td><td>${esc(b.protectedBy)}</td></tr>`).join('')}
</table>`}
${t.layout === 'detectors' ? '' : conclusion(d, t)}
<div><p><b><u>רשימת ליקויים ע"י המעבדה : ${d.defects.length ? '' : 'אין.'}</u></b></p>
${d.defects.length ? `<ol class="def">${d.defects.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}</div>
<div><p><u>הערות כלליות:</u></p>
<ul>${GENERAL(t).map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>
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
  <th>אישור המשרד:</th><td>${esc(c.adminName)}<br>${img(c.images.adminSignature, 'sigimg')}</td>
</tr>
</table>
${img(c.images.stamp, 'stamp')}
</div>
</div>
${foot}
</section>`,
  );
}
