import nodemailer from 'nodemailer';
import { loadSettings } from './settings';
import type { FormDef } from '../shared/forms/types';
import type { Submission } from './db/schema';

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };
export type MailInput = { to: string; subject: string; html: string; attachments?: MailAttachment[] };

export async function sendMail(m: MailInput): Promise<void> {
  if (process.env.MAIL_MODE === 'log') {
    console.log('[mail:log]', JSON.stringify({ to: m.to, subject: m.subject, html: m.html, attachments: m.attachments?.map((a) => a.filename) }));
    return;
  }
  const t = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await t.sendMail({ from: process.env.GMAIL_USER, ...m });
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
