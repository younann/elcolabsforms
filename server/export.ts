import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb, schema } from './db/client';
import { FORMS } from '../shared/forms';
import type { Cell, Sheet } from './xlsx';
import { alias } from 'drizzle-orm/pg-core';

const creator = alias(schema.users, 'job_creator');

export type ExportRow = { approvedAt: Date; client: string; site: string; address: string; inspector: string; form: string; testNumber: string; openedBy: 'בודק' | 'מנהל' };

const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' });

// counts per key, one column per form type
function counts(rows: ExportRow[], key: (r: ExportRow) => string, title: string, forms: string[]): Cell[][] {
  const by = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = by.get(key(r)) ?? new Map<string, number>();
    m.set(r.form, (m.get(r.form) ?? 0) + 1);
    by.set(key(r), m);
  }
  const line = (name: string, m: Map<string, number>): Cell[] => [name, ...forms.map((f) => m.get(f) ?? 0), [...m.values()].reduce((a, b) => a + b, 0)];
  const all = new Map(forms.map((f) => [f, rows.filter((r) => r.form === f).length]));
  return [
    [title, ...forms, 'סה"כ'],
    ...[...by.keys()].sort((a, b) => a.localeCompare(b, 'he')).map((k) => line(k, by.get(k)!)),
    line('סה"כ', all),
  ];
}

/** Billing workbook: details, per inspector, per client. */
export function exportSheets(rows: ExportRow[], formOrder: string[]): Sheet[] {
  const sorted = [...rows].sort((a, b) => a.approvedAt.getTime() - b.approvedAt.getTime());
  const forms = formOrder.filter((f) => rows.some((r) => r.form === f));
  return [
    {
      name: 'פירוט',
      rows: [
        ['תאריך אישור', 'לקוח', 'אתר', 'כתובת', 'בודק', 'סוג טופס', "מס' בדיקה", 'נפתח ע"י'],
        ...sorted.map((r) => [dayFmt.format(r.approvedAt), r.client, r.site, r.address, r.inspector, r.form, r.testNumber, r.openedBy]),
      ],
    },
    { name: 'לפי בודק', rows: counts(rows, (r) => r.inspector, 'בודק', forms) },
    { name: 'לפי לקוח', rows: counts(rows, (r) => r.client, 'לקוח', forms) },
  ];
}

/** Forms first approved in `month` (YYYY-MM, Israel time), as sheets. */
export async function monthSheets(month: string): Promise<Sheet[]> {
  const s = schema.submissions;
  const data = (k: string) => sql<string | null>`${s.data}->>${k}`;
  const rows = await getDb()
    .select({
      approvedAt: s.approvedAt,
      formId: s.formId,
      testNumber: s.testNumber,
      inspector: schema.users.displayName,
      clientName: schema.clients.name,
      siteName: schema.clientSites.name,
      siteAddress: schema.clientSites.address,
      ownSite: s.siteName,
      dataClient: data('customerName'),
      dataSite: data('siteName'),
      dataAddress: data('siteAddress'),
      creatorRole: creator.role,
    })
    .from(s)
    .innerJoin(schema.users, eq(schema.users.id, s.inspectorId))
    .leftJoin(schema.jobs, eq(schema.jobs.id, s.jobId))
    .leftJoin(schema.clients, eq(schema.clients.id, schema.jobs.clientId))
    .leftJoin(schema.clientSites, eq(schema.clientSites.id, schema.jobs.siteId))
    .leftJoin(creator, eq(creator.id, schema.jobs.createdBy))
    // first approval only: revisions carry a parent
    .where(and(isNull(s.parentId), isNotNull(s.approvedAt), sql`to_char(${s.approvedAt} at time zone 'Asia/Jerusalem', 'YYYY-MM') = ${month}`));

  const title = new Map(FORMS.map((f) => [f.id as string, f.shortTitle]));
  return exportSheets(
    rows.map((r) => ({
      approvedAt: r.approvedAt!,
      client: r.clientName ?? r.dataClient?.trim() ?? '',
      site: r.siteName ?? r.ownSite ?? r.dataSite ?? '',
      address: r.siteAddress ?? r.dataAddress ?? '',
      inspector: r.inspector,
      form: title.get(r.formId) ?? r.formId,
      testNumber: r.testNumber ?? '',
      // forms outside a job count as office work
      openedBy: r.creatorRole === 'inspector' ? 'בודק' : 'מנהל',
    })),
    FORMS.map((f) => f.shortTitle),
  );
}
