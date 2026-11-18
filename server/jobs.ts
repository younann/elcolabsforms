import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb, schema } from './db/client';
import { HttpError } from './http';
import { mirror } from './submissions';
import type { User } from './db/schema';
import { getForm } from '../shared/forms';
import { copyLabel, jobState, prefillData, type JobView, type PrefillCtx } from '../shared/jobs';
import type { Status } from '../shared/status';

type JobKeys = { id: string; inspectorId: string };

/** Pre-filled draft rows for a job, with ids so audits can join the same batch. */
export function buildJobRows(job: JobKeys & Record<string, unknown>, ctx: PrefillCtx, items: { formId: string; copy: number }[]) {
  const now = new Date();
  return items.map(({ formId, copy }) => {
    const def = getForm(formId);
    const data = prefillData(def, ctx);
    return {
      id: crypto.randomUUID(),
      formId,
      formVersion: def.version,
      status: 'draft',
      inspectorId: job.inspectorId,
      jobId: job.id,
      jobCopy: copy,
      data,
      ...mirror(data),
      updatedAt: now,
    } satisfies typeof schema.submissions.$inferInsert;
  });
}

const { jobs, clients, clientSites, users, submissions } = schema;
const inspector = alias(users, 'job_inspector');

/** Jobs with their latest form revisions; inspectors see only their own forms. */
export async function loadJobs(where: SQL | undefined, me: User): Promise<JobView[]> {
  const db = getDb();
  const own = me.role === 'admin' ? undefined : sql`exists (select 1 from ${submissions} s where s.job_id = ${jobs.id} and s.inspector_id = ${me.id})`;
  const rows = await db
    .select({ job: jobs, client: clients, site: clientSites, insp: { id: inspector.id, displayName: inspector.displayName, phone: inspector.phone } })
    .from(jobs)
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .innerJoin(clientSites, eq(clientSites.id, jobs.siteId))
    .innerJoin(inspector, eq(inspector.id, jobs.inspectorId))
    .where(and(where, own))
    .orderBy(desc(jobs.plannedDate), desc(jobs.createdAt));
  if (!rows.length) return [];
  // latest revision only: rows without a child
  const forms = await db
    .select({ id: submissions.id, jobId: submissions.jobId, formId: submissions.formId, jobCopy: submissions.jobCopy, status: submissions.status, inspectorId: submissions.inspectorId })
    .from(submissions)
    .where(
      and(
        inArray(submissions.jobId, rows.map((r) => r.job.id)),
        sql`not exists (select 1 from ${submissions} c where c.parent_id = ${submissions.id})`,
      ),
    )
    .orderBy(submissions.formId, submissions.jobCopy);

  return rows.flatMap(({ job, client, site, insp }) => {
    const all = forms.filter((f) => f.jobId === job.id);
    const mine = me.role === 'admin' ? all : all.filter((f) => f.inspectorId === me.id);
    if (!mine.length && me.role !== 'admin') return [];
    const count = (formId: string) => all.filter((f) => f.formId === formId).length;
    return [
      {
        id: job.id,
        client: { id: client.id, name: client.name, contactPerson: client.contactPerson, phone: client.phone },
        site: { id: site.id, name: site.name, address: site.address },
        // other inspectors' phones stay private
        inspector: { ...insp, phone: me.role === 'admin' || insp.id === me.id ? insp.phone : null },
        plannedDate: job.plannedDate,
        note: job.note,
        cancelledAt: job.cancelledAt?.toISOString() ?? null,
        state: jobState(all as { status: Status }[], job.cancelledAt),
        forms: mine.map((f) => ({
          id: f.id,
          formId: f.formId,
          jobCopy: f.jobCopy,
          status: f.status as Status,
          inspectorId: f.inspectorId,
          label: copyLabel(getForm(f.formId).shortTitle, f.jobCopy, count(f.formId)),
        })),
      },
    ];
  });
}

export async function loadJobView(id: string, me: User): Promise<JobView> {
  const [j] = await loadJobs(eq(jobs.id, id), me);
  if (!j) throw new HttpError(404, 'העבודה לא נמצאה');
  return j;
}
