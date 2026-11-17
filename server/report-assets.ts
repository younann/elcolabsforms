// loads what a report needs: form, attachments, people, settings
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from './db/client';
import type { Submission } from './db/schema';
import { getBlob } from './blobs';
import { loadSettings } from './settings';
import { getForm } from '../shared/forms';
import type { FormData } from '../shared/forms/types';
import { renderReportDocx, type DocxImage } from './docx';

export type ReportAssets = Awaited<ReturnType<typeof loadReportAssets>>;

const raw = async (key: string | null | undefined): Promise<DocxImage | undefined> => {
  if (!key) return undefined;
  const b = await getBlob(key);
  return b ? { data: new Uint8Array(b.data), contentType: b.contentType } : undefined;
};

// israel date of approval
export const ilDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export async function loadReportAssets(sub: Submission) {
  const db = getDb();
  const def = getForm(sub.formId, sub.formVersion);
  const data = (sub.data ?? {}) as FormData;
  const atts = await db
    .select()
    .from(schema.attachments)
    .where(eq(schema.attachments.submissionId, sub.id))
    .orderBy(asc(schema.attachments.createdAt));
  // oldest first per field
  const images: Record<string, DocxImage[]> = {};
  for (const a of atts) {
    const img = await raw(a.blobKey);
    if (img) (images[a.fieldId] ??= []).push(img);
  }
  const [inspector] = await db.select().from(schema.users).where(eq(schema.users.id, sub.inspectorId));
  const [approver] = sub.approvedBy ? await db.select().from(schema.users).where(eq(schema.users.id, sub.approvedBy)) : [];
  const settings = await loadSettings();
  return {
    def,
    data,
    images,
    settings,
    stamp: await raw(settings.stampKey),
    inspectorName: inspector?.displayName,
    approver: { name: approver?.displayName ?? '', date: ilDate(sub.approvedAt ?? new Date()), signature: await raw(approver?.signatureKey) },
  };
}

export const toDataUrl = (i: DocxImage) => `data:${i.contentType};base64,${Buffer.from(i.data).toString('base64')}`;

export function renderDocxFor(sub: Submission, a: ReportAssets): Promise<Buffer> {
  return renderReportDocx({
    def: a.def,
    data: a.data,
    images: a.images,
    revision: sub.revision,
    inspectorName: a.inspectorName,
    settings: { companyName: a.settings.companyName, companyDetails: a.settings.companyDetails, stamp: a.stamp },
    approver: a.approver,
  });
}

export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// file name base shared by pdf and docx
export const reportFileBase = (sub: Submission) =>
  `${sub.testNumber || sub.id}${sub.revision > 0 ? `-Rev${sub.revision}` : ''}`.replace(/[\\/:*?"<>|\s]+/g, '_');
