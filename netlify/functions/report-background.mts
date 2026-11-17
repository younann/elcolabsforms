import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { putBlob } from '../../server/blobs';
import { sendMail } from '../../server/mail';
import { htmlToPdf, internalKeyOk, pdfKey, renderReportHtml, reportSubject } from '../../server/pdf';
import { docxKey, fitsMail } from '../../server/docx';
import { DOCX_TYPE, loadReportAssets, renderDocxFor, toDataUrl } from '../../server/report-assets';
import { auditSafe } from '../../server/submissions';
import type { ReportImages } from '../../shared/pdf/Report';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const CLAIM_MINUTES = 14;

// true when this run claimed the row
async function run(id: string): Promise<boolean> {
  const db = getDb();
  const S = schema.submissions;
  // claim the row; a stale claim (crashed run) may be taken over
  const [sub] = await db
    .update(S)
    .set({ sendClaimedAt: new Date() })
    .where(
      and(
        eq(S.id, id),
        eq(S.status, 'sending'),
        or(isNull(S.sendClaimedAt), lt(S.sendClaimedAt, sql`now() - interval '${sql.raw(String(CLAIM_MINUTES))} minutes'`)),
      ),
    )
    .returning();
  if (!sub) {
    console.log('report skipped, not claimable', id);
    return false;
  }
  const assets = await loadReportAssets(sub);
  const { def, data, settings } = assets;
  if (!settings.recipientEmail) throw new Error('לא הוגדרה כתובת דוא"ל לשליחה');
  const images: ReportImages = {};
  for (const [fieldId, list] of Object.entries(assets.images)) images[fieldId] = list.map(toDataUrl);

  const html = renderReportHtml({
    def,
    data,
    images,
    revision: sub.revision,
    inspectorName: assets.inspectorName,
    settings: { companyName: settings.companyName, companyDetails: settings.companyDetails, stamp: assets.stamp && toDataUrl(assets.stamp) },
    approver: { ...assets.approver, signature: assets.approver.signature && toDataUrl(assets.approver.signature) },
  });
  const footer = [settings.companyName, def.docNumber || def.shortTitle, sub.revision > 0 ? `Rev ${sub.revision}` : '']
    .filter(Boolean)
    .join(' · ');
  const pdf = await htmlToPdf(html, { footerText: footer });
  const key = pdfKey(id, sub.revision);
  await putBlob(key, pdf, 'application/pdf');

  // word copy is best effort; the pdf stays the record
  let docx: Buffer | null = null;
  try {
    docx = await renderDocxFor(sub, assets);
    await putBlob(docxKey(id, sub.revision), docx, DOCX_TYPE);
  } catch (e) {
    docx = null;
    console.error('docx failed, sending pdf only', id, e);
    if (sub.approvedBy) await auditSafe(id, sub.approvedBy, 'docx_failed', { note: (e instanceof Error ? e.message : String(e)).slice(0, 500) });
  }
  // keep the email under gmail's limit
  if (docx && !fitsMail(pdf, docx)) {
    const note = `attachments too large (${pdf.length + docx.length} bytes), sending pdf only`;
    console.warn('docx skipped:', note, id);
    if (sub.approvedBy) await auditSafe(id, sub.approvedBy, 'docx_failed', { note });
    docx = null;
  }

  const siteName = sub.siteName ?? String(data.siteName ?? '');
  const testNumber = sub.testNumber ?? String(data.testNumber ?? '');
  const subject = reportSubject(def, siteName, testNumber, sub.revision);
  const fileBase = `${testNumber || id}${sub.revision > 0 ? `-Rev${sub.revision}` : ''}`.replace(/[\\/:*?"<>|\s]+/g, '_');
  const sent = await sendMail({
    to: settings.recipientEmail,
    subject,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif"><p>מצורף דוח בדיקה מאושר.</p><p>${esc(subject)}</p></div>`,
    attachments: [
      { filename: `${fileBase}.pdf`, content: pdf },
      ...(docx ? [{ filename: `${fileBase}.docx`, content: docx, contentType: DOCX_TYPE }] : []),
    ],
  });

  await db
    .update(schema.submissions)
    .set({ status: 'emailed', pdfKey: key, emailedAt: new Date(), sendError: null, sendClaimedAt: null, mailLogged: sent.logged, updatedAt: new Date() })
    .where(and(eq(S.id, id), eq(S.status, 'sending')));
  return true;
}

export default async (req: Request) => {
  if (req.method !== 'POST' || !internalKeyOk(req.headers.get('x-internal-key'))) {
    console.warn('report-background: rejected request');
    return new Response('forbidden', { status: 403 });
  }
  let id = '';
  try {
    id = String(((await req.json()) as { id?: unknown }).id ?? '');
  } catch {
    // bad body
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('bad request', { status: 400 });
  try {
    await run(id);
  } catch (e) {
    console.error('report failed', id, e);
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    try {
      await getDb()
        .update(schema.submissions)
        .set({ status: 'send_failed', sendError: msg, sendClaimedAt: null, updatedAt: new Date() })
        .where(and(eq(schema.submissions.id, id), eq(schema.submissions.status, 'sending')));
    } catch (e2) {
      console.error('report failure not recorded', id, e2);
    }
  }
  return new Response(null, { status: 202 });
};
