// certificate: build, store, mail to the client
import { and, desc, eq, isNull, like, lt, or, sql } from 'drizzle-orm';
import { getDb, schema } from './db/client';
import type { Certificate, Submission } from './db/schema';
import { getBlob, putBlob } from './blobs';
import { loadSettings } from './settings';
import { sendMail } from './mail';
import { htmlToPdf } from './pdf';
import { renderCertificateHtml } from './certificate';
import { CertData, certTemplate, nextCertNumber } from '../shared/certificates';
import { getForm } from '../shared/forms';

const CLAIM_MINUTES = 14;

export const certPdfKey = (id: string) => `cert/${id}.pdf`;
export const ilDay = (ymd: string) => ymd.split('-').reverse().join('/');

async function dataUrl(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const b = await getBlob(key);
  return b ? `data:${b.contentType};base64,${Buffer.from(b.data).toString('base64')}` : null;
}

/** Certificate HTML for a form, from the admin's values. */
export async function certificateHtml(sub: Submission, input: { number: string; issueDate: string; data: CertData }): Promise<string> {
  const template = certTemplate(sub.formId);
  if (!template) throw new Error('אין תבנית תעודה לטופס זה');
  const db = getDb();
  const def = getForm(sub.formId, sub.formVersion);
  const sigField = def.sections.flatMap((s) => s.fields).find((f) => f.type === 'signature' && f.role === 'inspector');
  const [sig] = sigField
    ? await db
        .select()
        .from(schema.attachments)
        .where(and(eq(schema.attachments.submissionId, sub.id), eq(schema.attachments.fieldId, sigField.id)))
        .orderBy(desc(schema.attachments.createdAt))
        .limit(1)
    : [];
  const [inspector] = await db.select().from(schema.users).where(eq(schema.users.id, sub.inspectorId));
  const [engineer] = sub.engineerId ? await db.select().from(schema.users).where(eq(schema.users.id, sub.engineerId)) : [];
  const settings = await loadSettings();
  return renderCertificateHtml({
    template,
    number: input.number,
    issueDate: ilDay(input.issueDate),
    data: input.data,
    inspectorName: inspector?.displayName ?? '',
    engineerName: engineer?.displayName ?? '',
    images: {
      inspectorSignature: await dataUrl(sig?.blobKey),
      engineerSignature: await dataUrl(engineer?.signatureKey),
      stamp: await dataUrl(settings.stampKey),
    },
  });
}

/** Suggested next number for this form's template, this year. */
export async function suggestNumber(formId: string, year: number): Promise<string | null> {
  const t = certTemplate(formId);
  if (!t) return null;
  const head = `${t.prefix}${String(year % 100).padStart(2, '0')}`;
  const rows = await getDb()
    .select({ number: schema.certificates.number })
    .from(schema.certificates)
    .where(like(schema.certificates.number, `${head}%`));
  return nextCertNumber(t.prefix, year, rows.map((r) => r.number));
}

// true when this run claimed and finished the row
export async function runCertificate(id: string): Promise<boolean> {
  const db = getDb();
  const S = schema.submissions;
  const [sub] = await db
    .update(S)
    .set({ sendClaimedAt: new Date() })
    .where(
      and(
        eq(S.id, id),
        eq(S.status, 'cert_sending'),
        or(isNull(S.sendClaimedAt), lt(S.sendClaimedAt, sql`now() - interval '${sql.raw(String(CLAIM_MINUTES))} minutes'`)),
      ),
    )
    .returning();
  if (!sub) return false;
  try {
    const [cert] = await db.select().from(schema.certificates).where(eq(schema.certificates.submissionId, id));
    if (!cert) throw new Error('התעודה לא נמצאה');
    const { pdf, key, filename } = await certificatePdf(sub, cert);
    const settings = await loadSettings();
    const site = sub.siteName ?? '';
    const subject = cert.number ? `תעודת בדיקה ${cert.number} – ${site}` : `דוח בדיקה – ${site}`;
    const sent = await sendMail({
      to: cert.sentTo,
      cc: settings.recipientEmail || undefined,
      subject,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif"><p>שלום,</p><p>מצורפת ${cert.number ? 'תעודת הבדיקה' : 'דוח הבדיקה'} עבור ${escHtml(site)}.</p><p>${escHtml(settings.companyName)}</p></div>`,
      attachments: [{ filename, content: pdf }],
    });
    await db.batch([
      db.update(schema.certificates).set({ status: 'sent', pdfKey: key, sentAt: new Date(), error: null, mailLogged: sent.logged }).where(eq(schema.certificates.id, cert.id)),
      db.update(S).set({ status: 'certified', sendClaimedAt: null, sendError: null, updatedAt: new Date() }).where(and(eq(S.id, id), eq(S.status, 'cert_sending'))),
    ]);
    return true;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error('certificate failed', id, e);
    await db.batch([
      db.update(schema.certificates).set({ status: 'failed', error: msg }).where(eq(schema.certificates.submissionId, id)),
      db.update(S).set({ status: 'cert_failed', sendError: msg, sendClaimedAt: null, updatedAt: new Date() }).where(and(eq(S.id, id), eq(S.status, 'cert_sending'))),
    ]);
    return false;
  }
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function certificatePdf(sub: Submission, cert: Certificate) {
  // no template yet: the approved report goes instead
  if (!cert.number) {
    const b = sub.pdfKey ? await getBlob(sub.pdfKey) : null;
    if (!b) throw new Error('הדוח לא נמצא');
    return { pdf: Buffer.from(b.data), key: sub.pdfKey!, filename: `${(sub.testNumber || sub.id).replace(/[\\/:*?"<>|\s]+/g, '_')}.pdf` };
  }
  const html = await certificateHtml(sub, { number: cert.number, issueDate: cert.issueDate, data: CertData.parse(cert.data) });
  const pdf = await htmlToPdf(html, { plain: true });
  const key = certPdfKey(sub.id);
  await putBlob(key, pdf, 'application/pdf');
  return { pdf, key, filename: `${cert.number}.pdf` };
}

// background fn answers 202; failure only logged
export async function triggerCertificate(req: Request, id: string) {
  try {
    const base = process.env.APP_URL || new URL(req.url).origin;
    const r = await fetch(`${base}/.netlify/functions/certificate-background`, {
      method: 'POST',
      headers: { 'x-internal-key': process.env.INTERNAL_KEY ?? '' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) console.error('certificate trigger status', r.status);
  } catch (e) {
    console.error('certificate trigger failed', e);
  }
}
