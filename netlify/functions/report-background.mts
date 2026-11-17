import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { getBlob, putBlob, dataUrl } from '../../server/blobs';
import { sendMail } from '../../server/mail';
import { htmlToPdf, internalKeyOk, pdfKey, renderReportHtml, reportSubject } from '../../server/pdf';
import { getForm } from '../../shared/forms';
import type { FormData } from '../../shared/forms/types';
import type { ReportImages } from '../../shared/pdf/Report';
import { loadSettings } from './settings.mts';

const blobUrl = async (key: string | null | undefined) => {
  if (!key) return undefined;
  const b = await getBlob(key);
  return b ? dataUrl(b) : undefined;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// israel date of approval
const ilDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

async function run(id: string) {
  const db = getDb();
  const [sub] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id));
  if (!sub || sub.status !== 'sending') {
    console.log('report skipped', id, sub?.status);
    return;
  }
  const def = getForm(sub.formId, sub.formVersion);
  const data = (sub.data ?? {}) as FormData;
  const atts = await db
    .select()
    .from(schema.attachments)
    .where(eq(schema.attachments.submissionId, id))
    .orderBy(asc(schema.attachments.createdAt));
  const images: ReportImages = {};
  for (const a of atts) {
    const src = await blobUrl(a.blobKey);
    if (src) (images[a.fieldId] ??= []).push(src);
  }
  const [inspector] = await db.select().from(schema.users).where(eq(schema.users.id, sub.inspectorId));
  const [approver] = sub.approvedBy ? await db.select().from(schema.users).where(eq(schema.users.id, sub.approvedBy)) : [];
  const settings = await loadSettings();
  if (!settings.recipientEmail) throw new Error('לא הוגדרה כתובת דוא"ל לשליחה');

  const html = renderReportHtml({
    def,
    data,
    images,
    revision: sub.revision,
    inspectorName: inspector?.displayName,
    settings: { companyName: settings.companyName, companyDetails: settings.companyDetails, stamp: await blobUrl(settings.stampKey) },
    approver: {
      name: approver?.displayName ?? '',
      date: ilDate(sub.approvedAt ?? new Date()),
      signature: await blobUrl(approver?.signatureKey),
    },
  });
  const footer = [settings.companyName, def.docNumber || def.shortTitle, sub.revision > 0 ? `Rev ${sub.revision}` : '']
    .filter(Boolean)
    .join(' · ');
  const pdf = await htmlToPdf(html, { footerText: footer });
  const key = pdfKey(id, sub.revision);
  await putBlob(key, pdf, 'application/pdf');

  const siteName = sub.siteName ?? String(data.siteName ?? '');
  const testNumber = sub.testNumber ?? String(data.testNumber ?? '');
  const subject = reportSubject(def, siteName, testNumber, sub.revision);
  const fileBase = `${testNumber || id}${sub.revision > 0 ? `-Rev${sub.revision}` : ''}`.replace(/[\\/:*?"<>|\s]+/g, '_');
  await sendMail({
    to: settings.recipientEmail,
    subject,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif"><p>מצורף דוח בדיקה מאושר.</p><p>${esc(subject)}</p></div>`,
    attachments: [{ filename: `${fileBase}.pdf`, content: pdf }],
  });

  await db
    .update(schema.submissions)
    .set({ status: 'emailed', pdfKey: key, emailedAt: new Date(), sendError: null, updatedAt: new Date() })
    .where(and(eq(schema.submissions.id, id), eq(schema.submissions.status, 'sending')));
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
    await getDb()
      .update(schema.submissions)
      .set({ status: 'send_failed', sendError: msg, updatedAt: new Date() })
      .where(and(eq(schema.submissions.id, id), eq(schema.submissions.status, 'sending')));
  }
  return new Response(null, { status: 202 });
};
