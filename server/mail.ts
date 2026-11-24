import nodemailer from 'nodemailer';
import { loadSettings } from './settings';
import type { FormDef } from '../shared/forms/types';
import type { Submission } from './db/schema';

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };
export type MailInput = { to: string; cc?: string; subject: string; html: string; attachments?: MailAttachment[] };

export type MailMode = 'log' | 'live';
export const mailMode = (): MailMode => (process.env.MAIL_MODE === 'log' ? 'log' : 'live');

/** `logged`: test mode, nothing was sent. */
export async function sendMail(m: MailInput): Promise<{ logged: boolean }> {
  if (mailMode() === 'log') {
    console.log('[mail:log]', JSON.stringify({ to: m.to, cc: m.cc, subject: m.subject, html: m.html, attachments: m.attachments?.map((a) => a.filename) }));
    return { logged: true };
  }
  const t = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await t.sendMail({ from: process.env.GMAIL_USER, ...m });
  return { logged: false };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function buildNotice(s: Submission, def: FormDef, inspectorName: string, appUrl: string) {
  const site = s.siteName ?? '';
  const link = `${appUrl}/admin/review/${s.id}`;
  return {
    subject: `טופס ממתין לאישור – ${def.title} – ${site}`,
    html:
      `<div dir="rtl" style="font-family:Arial,sans-serif">` +
      `<p>טופס ממתין לאישור.</p>` +
      `<p>${esc(def.title)} – ${esc(site)}<br>מפקח: ${esc(inspectorName)}</p>` +
      `<p><a href="${esc(link)}">${esc(link)}</a></p></div>`,
  };
}

// failure is logged, never thrown
export async function notifySubmitted(s: Submission, def: FormDef, inspectorName: string): Promise<void> {
  try {
    const { recipientEmail } = await loadSettings();
    if (!recipientEmail) {
      console.warn('notify skipped: no recipientEmail');
      return;
    }
    const n = buildNotice(s, def, inspectorName, process.env.APP_URL ?? '');
    await sendMail({ to: recipientEmail, ...n });
  } catch (e) {
    console.error('notify failed', e);
  }
}

/** Office note after the engineer acts; failure is logged, never thrown. */
export async function notifyEngineerDone(s: Submission, def: FormDef, engineerName: string, note?: string): Promise<void> {
  try {
    const { recipientEmail } = await loadSettings();
    if (!recipientEmail) return console.warn('notify skipped: no recipientEmail');
    const site = s.siteName ?? '';
    const link = `${process.env.APP_URL ?? ''}/admin/review/${s.id}`;
    const subject = note ? `הוחזר ע"י המהנדס – ${def.title} – ${site}` : `אושר ע"י המהנדס, ניתן להפיק תעודה – ${def.title} – ${site}`;
    await sendMail({
      to: recipientEmail,
      subject,
      html:
        `<div dir="rtl" style="font-family:Arial,sans-serif"><p>${esc(subject)}</p><p>מהנדס: ${esc(engineerName)}</p>` +
        (note ? `<p style="white-space:pre-wrap">${esc(note)}</p>` : '') +
        `<p><a href="${esc(link)}">${esc(link)}</a></p></div>`,
    });
  } catch (e) {
    console.error('notify failed', e);
  }
}
