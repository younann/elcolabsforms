import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { background, handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { buildJobRows, loadJobs, loadJobView } from '../../server/jobs';
import { notifyJob, type JobEvent } from '../../server/push';
import { canManageJob, JobAddForms, JobCreate, JobInspector, JobPatch, type PrefillCtx } from '../../shared/jobs';
import type { Status } from '../../shared/status';

const { jobs, clients, clientSites, users, submissions, auditLog } = schema;
const Id = z.uuid();
const PENDING: Status[] = ['draft', 'returned'];
const STATES = ['open', 'done', 'cancelled', 'cancelled-open'];

async function prefillCtx(clientId: string, siteId: string, plannedDate: string): Promise<PrefillCtx> {
  const db = getDb();
  const [[c], [s]] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, clientId)),
    db.select().from(clientSites).where(eq(clientSites.id, siteId)),
  ]);
  if (!c || !c.active) throw new HttpError(400, 'הלקוח לא נמצא או מוסתר');
  if (!s || !s.active || s.clientId !== c.id) throw new HttpError(400, 'האתר לא נמצא או אינו שייך ללקוח');
  return { plannedDate, siteName: s.name, siteAddress: s.address, clientName: c.name, clientPhone: c.phone, clientEmail: c.email };
}

const adminIds = () =>
  getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.active, true)))
    .then((r) => r.map((u) => u.id));

const auditRows = (ids: string[], userId: string, action: string, extra: Partial<typeof auditLog.$inferInsert> = {}) =>
  ids.map((submissionId) => ({ submissionId, userId, action, ...extra }));

export default handle(async (req, ctx) => {
  const me = await requireUser(req);
  const db = getDb();
  const url = new URL(req.url);
  const [, , , id, sub] = url.pathname.split('/'); // ['', 'api', 'jobs', id, sub]
  const admin = () => {
    if (me.role !== 'admin') throw new HttpError(403, 'אין הרשאה');
  };

  if (!id) {
    if (req.method === 'GET') {
      const conds: SQL[] = [];
      for (const [key, col] of [['inspectorId', jobs.inspectorId], ['clientId', jobs.clientId]] as const) {
        const v = url.searchParams.get(key);
        if (!v) continue;
        if (!Id.safeParse(v).success) throw new HttpError(400, 'נתונים לא תקינים');
        conds.push(eq(col, v));
      }
      const state = url.searchParams.get('state');
      if (state && !STATES.includes(state)) throw new HttpError(400, 'נתונים לא תקינים');
      // shortcut: state is derived, so it filters after loading; add a stored state if jobs reach thousands
      const list = await loadJobs(conds.length ? and(...conds) : undefined, me);
      return json({ jobs: state ? list.filter((j) => j.state === state) : list });
    }
    if (req.method === 'POST') {
      if (me.role !== 'admin' && me.role !== 'inspector') throw new HttpError(403, 'אין הרשאה');
      const b = await parseBody(req, JobCreate);
      // inspectors open work only for themselves
      if (me.role === 'inspector' && b.inspectorId !== me.id) throw new HttpError(403, 'אין הרשאה');
      const [p, [insp]] = await Promise.all([
        prefillCtx(b.clientId, b.siteId, b.plannedDate),
        db.select().from(users).where(eq(users.id, b.inspectorId)),
      ]);
      if (!insp || !insp.active || insp.role !== 'inspector') throw new HttpError(400, 'הבודק לא נמצא או אינו פעיל');
      const job = { id: crypto.randomUUID(), clientId: b.clientId, siteId: b.siteId, inspectorId: insp.id, plannedDate: b.plannedDate, note: b.note ?? null, createdBy: me.id };
      const rows = buildJobRows(job, p, b.forms.map((formId) => ({ formId, copy: 1 })));
      // all or nothing: job, drafts and audits
      await db.batch([
        db.insert(jobs).values(job),
        db.insert(submissions).values(rows),
        db.insert(auditLog).values(auditRows(rows.map((r) => r.id), me.id, 'create', { note: `job ${job.id}` })),
      ]);
      if (me.role === 'admin') background(ctx, notifyJob('created', job.id, [insp.id]));
      else background(ctx, adminIds().then((ids) => notifyJob('opened', job.id, ids)));
      return json({ job: await loadJobView(job.id, me) }, 201);
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (!Id.safeParse(id).success || (sub && !['forms', 'inspector', 'cancel'].includes(sub))) throw new HttpError(404, 'העבודה לא נמצאה');

  if (!sub && req.method === 'GET') return json({ job: await loadJobView(id, me) });

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) throw new HttpError(404, 'העבודה לא נמצאה');
  if (!canManageJob(me, job)) throw new HttpError(403, 'אין הרשאה');
  // office hears about inspector changes
  const tellAdmins = (event: JobEvent) => {
    if (me.role !== 'admin') background(ctx, adminIds().then((ids) => notifyJob(event, id, ids)));
  };
  // an inspector may lose sight of the job after reassign or cancel
  const viewAfter = () => loadJobView(id, me).catch((e) => (me.role === 'admin' ? Promise.reject(e) : null));
  if (job.cancelledAt) throw new HttpError(409, 'העבודה בוטלה');
  const live = and(eq(jobs.id, id), isNull(jobs.cancelledAt));

  if (!sub && req.method === 'PATCH') {
    const b = await parseBody(req, JobPatch);
    if (b.plannedDate === undefined && b.note === undefined) throw new HttpError(400, 'אין מה לעדכן');
    const [u] = await db.update(jobs).set(b).where(live).returning({ id: jobs.id });
    if (!u) throw new HttpError(409, 'העבודה בוטלה');
    return json({ job: await loadJobView(id, me) });
  }

  if (sub === 'forms' && req.method === 'POST') {
    const b = await parseBody(req, JobAddForms);
    const [p, have] = await Promise.all([
      // details as they are now
      prefillCtx(job.clientId, job.siteId, job.plannedDate),
      db.selectDistinct({ formId: submissions.formId }).from(submissions).where(eq(submissions.jobId, id)),
    ]);
    if (have.some((h) => b.forms.includes(h.formId))) throw new HttpError(409, 'הטופס כבר קיים בעבודה');
    const rows = buildJobRows(job, p, b.forms.map((formId) => ({ formId, copy: 1 })));
    await db.batch([db.insert(submissions).values(rows), db.insert(auditLog).values(auditRows(rows.map((r) => r.id), me.id, 'create', { note: `job ${id}` }))]);
    background(ctx, notifyJob('forms', id, [job.inspectorId]));
    return json({ job: await loadJobView(id, me) }, 201);
  }

  if (sub === 'inspector' && req.method === 'POST') {
    const b = await parseBody(req, JobInspector);
    const [target] = await db.select().from(users).where(eq(users.id, b.inspectorId));
    if (!target || !target.active || target.role !== 'inspector') throw new HttpError(400, 'הבודק לא נמצא או אינו פעיל');
    if (target.id === job.inspectorId) throw new HttpError(400, 'העבודה כבר משויכת לבודק הזה');
    const moving = await db
      .select({ id: submissions.id, from: submissions.inspectorId })
      .from(submissions)
      .where(and(eq(submissions.jobId, id), inArray(submissions.status, PENDING)));
    const ids = moving.filter((m) => m.from !== target.id).map((m) => m.id);
    await db.batch([
      db.update(jobs).set({ inspectorId: target.id }).where(live),
      ...(ids.length
        ? [
            db.update(submissions).set({ inspectorId: target.id, updatedAt: new Date() }).where(and(inArray(submissions.id, ids), inArray(submissions.status, PENDING))),
            db.insert(auditLog).values(
              moving.filter((m) => ids.includes(m.id)).map((m) => ({ submissionId: m.id, userId: me.id, action: 'reassign', oldValue: m.from, newValue: target.id, note: `job → ${target.displayName}` })),
            ),
          ]
        : []),
    ]);
    background(ctx, notifyJob('inspector', id, [target.id]));
    tellAdmins('inspector');
    return json({ job: await viewAfter() });
  }

  if (sub === 'cancel' && req.method === 'POST') {
    // untouched drafts have no uploads, so no blobs to clean
    const [, , kept] = await db.batch([
      db.update(jobs).set({ cancelledAt: new Date() }).where(live),
      db.delete(submissions).where(and(eq(submissions.jobId, id), eq(submissions.status, 'draft'), isNull(submissions.touchedAt))),
      db.select({ inspectorId: submissions.inspectorId }).from(submissions).where(and(eq(submissions.jobId, id), inArray(submissions.status, PENDING))),
    ]);
    background(ctx, notifyJob('cancelled', id, [...new Set([job.inspectorId, ...kept.map((k) => k.inspectorId)])].filter((u) => u !== me.id)));
    tellAdmins('cancelled');
    return json({ job: await viewAfter() });
  }

  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = {
  path: ['/api/jobs', '/api/jobs/:id', '/api/jobs/:id/forms', '/api/jobs/:id/inspector', '/api/jobs/:id/cancel'],
};
