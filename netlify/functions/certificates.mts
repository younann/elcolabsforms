import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { getBlob } from '../../server/blobs';
import { asData, assertAccess, auditSafe, loadSubmission, transition } from '../../server/submissions';
import { certificateHtml, suggestNumber, triggerCertificate } from '../../server/certificates';
import { CERT_NUMBER, CertData, certTemplate } from '../../shared/certificates';
import { canTransition, type Status } from '../../shared/status';

const Ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Number_ = z.string().trim().regex(CERT_NUMBER, 'מספר תעודה לא תקין');
const Preview = z.object({ number: Number_, issueDate: Ymd, data: CertData });
const Issue = z.discriminatedUnion('withoutTemplate', [
  z.object({ withoutTemplate: z.literal(false), number: Number_, issueDate: Ymd, data: CertData, sentTo: z.email() }),
  z.object({ withoutTemplate: z.literal(true), sentTo: z.email() }),
]);

const todayIL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

export default handle(async (req) => {
  const me = await requireUser(req);
  const db = getDb();
  const [, , , id, , sub] = new URL(req.url).pathname.split('/'); // ['', 'api', 'submissions', id, 'certificate', sub]
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'הטופס לא נמצא');
  const s = await loadSubmission(id);
  assertAccess(me, s);
  const [cert] = await db.select().from(schema.certificates).where(eq(schema.certificates.submissionId, id));

  if (sub === 'pdf') {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    const b = cert?.status === 'sent' && cert.pdfKey ? await getBlob(cert.pdfKey) : null;
    if (!b) throw new HttpError(404, 'התעודה לא נמצאה');
    const name = cert.number ?? s.testNumber ?? s.id;
    return new Response(b.data, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="certificate.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
        'cache-control': 'private, no-store',
      },
    });
  }

  // engineer checks the saved certificate before signing
  if (sub === 'preview' && req.method === 'GET') {
    if (me.role !== 'admin' && me.role !== 'engineer') throw new HttpError(403, 'אין הרשאה');
    if (!cert?.number) throw new HttpError(404, 'התעודה לא נמצאה');
    const html = await certificateHtml(s, { number: cert.number, issueDate: cert.issueDate, data: CertData.parse(cert.data) });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' } });
  }

  if (me.role !== 'admin') throw new HttpError(403, 'אין הרשאה');
  const template = certTemplate(s.formId);

  if (!sub && req.method === 'GET') {
    let recipient = String(asData(s.data).customerEmail ?? '').trim();
    if (s.jobId) {
      const [c] = await db
        .select({ email: schema.clients.email })
        .from(schema.jobs)
        .innerJoin(schema.clients, eq(schema.clients.id, schema.jobs.clientId))
        .where(eq(schema.jobs.id, s.jobId));
      recipient = c?.email?.trim() || recipient;
    }
    return json({
      status: s.status,
      certificate: cert ?? null,
      template: template && { prefix: template.prefix, title: template.title, layout: template.layout },
      prefill: template ? template.prefill(asData(s.data)) : null,
      suggestedNumber: await suggestNumber(s.formId, Number(todayIL().slice(0, 4))),
      issueDate: todayIL(),
      recipient,
    });
  }

  if (sub === 'preview') {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    if (!template) throw new HttpError(409, 'אין תבנית תעודה לטופס זה');
    const b = await parseBody(req, Preview);
    // html, not pdf: chromium is too slow for a sync function
    return new Response(await certificateHtml(s, b), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' } });
  }

  if (sub === 'retry') {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const to = canTransition(s.status as Status, 'cert_retry', me.role, s.updatedAt);
    if (!to || !cert) throw new HttpError(409, 'פעולה לא אפשרית במצב הנוכחי');
    await db.update(schema.certificates).set({ status: 'sending', error: null }).where(eq(schema.certificates.id, cert.id));
    const row = await transition(id, s.status as Status, { status: to, sendError: null, sendClaimedAt: null }, s.updatedAt);
    await triggerCertificate(req, id);
    await auditSafe(id, me.id, 'cert_retry');
    return json({ submission: row });
  }

  if (!sub && req.method === 'POST') {
    const b = await parseBody(req, Issue);
    if (!b.withoutTemplate && !template) throw new HttpError(409, 'אין תבנית תעודה לטופס זה');
    if (b.withoutTemplate && template) throw new HttpError(409, 'לטופס זה יש תבנית תעודה');
    const to = canTransition(s.status as Status, 'issue', me.role);
    if (!to) throw new HttpError(409, 'פעולה לא אפשרית במצב הנוכחי');
    const values = {
      number: b.withoutTemplate ? null : b.number,
      issueDate: b.withoutTemplate ? todayIL() : b.issueDate,
      data: b.withoutTemplate ? {} : b.data,
      sentTo: b.sentTo,
    };
    // draft from approve: send with the admin's last edits
    const draft = cert?.status === 'draft';
    try {
      if (draft) await db.update(schema.certificates).set({ ...values, status: 'sending', error: null }).where(eq(schema.certificates.id, cert.id));
      else await db.insert(schema.certificates).values({ submissionId: id, ...values, createdBy: me.id });
    } catch (e) {
      const text = `${String(e)} ${String((e as { cause?: unknown }).cause ?? '')}`;
      if (/certificates_number/i.test(text)) throw new HttpError(409, 'המספר כבר בשימוש');
      if (/certificates_submission/i.test(text)) throw new HttpError(409, 'כבר הופקה תעודה לטופס זה');
      throw e;
    }
    let row;
    try {
      row = await transition(id, 'engineer_approved', { status: to, sendError: null, sendClaimedAt: null }, s.updatedAt);
    } catch (e) {
      // status moved meanwhile: undo so a retry can issue
      await (draft
        ? db.update(schema.certificates).set({ status: 'draft' }).where(eq(schema.certificates.id, cert.id))
        : db.delete(schema.certificates).where(eq(schema.certificates.submissionId, id))
      ).catch(() => {});
      throw e;
    }
    await triggerCertificate(req, id);
    await auditSafe(id, me.id, 'issue', { note: b.withoutTemplate ? `report → ${b.sentTo}` : `${b.number} → ${b.sentTo}` });
    return json({ submission: row }, 201);
  }
  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = {
  path: ['/api/submissions/:id/certificate', '/api/submissions/:id/certificate/pdf', '/api/submissions/:id/certificate/preview', '/api/submissions/:id/certificate/retry'],
};
