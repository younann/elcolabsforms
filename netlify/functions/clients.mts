import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { getDb, schema } from '../../server/db/client';
import { handle, json, parseBody, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { loadJobs } from '../../server/jobs';
import { ClientInput, ClientPatch, SiteInput, SitePatch } from '../../shared/clients';

const { clients, clientSites, jobs } = schema;

const siteView = (s: typeof clientSites.$inferSelect) => ({
  id: s.id, clientId: s.clientId, name: s.name, address: s.address, formIds: s.formIds, active: s.active,
});
const clientView = (c: typeof clients.$inferSelect) => ({
  id: c.id, name: c.name, contactPerson: c.contactPerson, phone: c.phone, email: c.email, active: c.active,
});

const notFound = (what: string) => new HttpError(404, `${what} לא נמצא`);
const uuidOr404 = (v: string | undefined, what: string) => {
  if (v !== undefined && !z.uuid().safeParse(v).success) throw notFound(what);
  return v;
};

export default handle(async (req, ctx) => {
  const me = await requireUser(req);
  const db = getDb();
  const id = uuidOr404(ctx.params?.id, 'לקוח');
  const siteId = uuidOr404(ctx.params?.siteId, 'אתר');
  const onSites = new URL(req.url).pathname.includes('/sites');
  const admin = me.role === 'admin';
  // inspectors: read names, add clients and sites, nothing else
  const inspectorOk = me.role === 'inspector' && (req.method === 'GET' ? !siteId : req.method === 'POST');
  if (!admin && !inspectorOk) throw new HttpError(403, 'אין הרשאה');

  if (!id) {
    if (req.method === 'GET') {
      const q = new URL(req.url).searchParams.get('q')?.trim();
      const rows = await db
        .select({
          id: clients.id, name: clients.name, contactPerson: clients.contactPerson, phone: clients.phone,
          email: clients.email, active: clients.active,
          siteCount: sql<number>`(select count(*)::int from client_sites s where s.client_id = ${clients.id} and s.active)`,
        })
        .from(clients)
        .where(and(q ? ilike(clients.name, `%${q.replace(/[\\%_]/g, '\\$&')}%`) : undefined, admin ? undefined : eq(clients.active, true)))
        .orderBy(desc(clients.active), asc(clients.name));
      return json({ clients: admin ? rows : rows.map((r) => ({ ...r, contactPerson: null, phone: null, email: null })) });
    }
    if (req.method === 'POST') {
      const b = await parseBody(req, ClientInput);
      const [c] = await db.insert(clients).values(b).returning();
      return json({ client: clientView(c) }, 201);
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (!onSites) {
    if (req.method === 'GET') {
      const [c] = await db.select().from(clients).where(eq(clients.id, id));
      if (!c || (!admin && !c.active)) throw notFound('לקוח');
      const sites = await db.select().from(clientSites).where(eq(clientSites.clientId, id)).orderBy(desc(clientSites.active), asc(clientSites.name));
      if (!admin) {
        const shown = sites.filter((s) => s.active).map((s) => ({ ...siteView(s), address: '' }));
        return json({ client: { ...clientView(c), contactPerson: null, phone: null, email: null }, sites: shown, jobs: [] });
      }
      const list = await loadJobs(eq(jobs.clientId, id), me);
      return json({ client: clientView(c), sites: sites.map(siteView), jobs: list });
    }
    if (req.method === 'PATCH') {
      if (!admin) throw new HttpError(403, 'אין הרשאה');
      const b = await parseBody(req, ClientPatch);
      if (!Object.keys(b).length) throw new HttpError(400, 'אין מה לעדכן');
      const [c] = await db.update(clients).set(b).where(eq(clients.id, id)).returning();
      if (!c) throw notFound('לקוח');
      return json({ client: clientView(c) });
    }
    if (req.method === 'DELETE') {
      if (!admin) throw new HttpError(403, 'אין הרשאה');
      const [used] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.clientId, id)).limit(1);
      if (used) throw new HttpError(409, 'הלקוח בשימוש. אפשר להסתיר אותו');
      const [c] = await db.delete(clients).where(eq(clients.id, id)).returning({ id: clients.id });
      if (!c) throw notFound('לקוח');
      return json({ ok: true });
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (!siteId) {
    if (req.method === 'POST') {
      const b = await parseBody(req, SiteInput);
      const [c] = await db.select({ id: clients.id, active: clients.active }).from(clients).where(eq(clients.id, id));
      if (!c || (!admin && !c.active)) throw notFound('לקוח');
      const [s] = await db.insert(clientSites).values({ ...b, clientId: id }).returning();
      return json({ site: siteView(s) }, 201);
    }
    throw new HttpError(405, 'Method not allowed');
  }

  const own = and(eq(clientSites.id, siteId), eq(clientSites.clientId, id));
  if (req.method === 'PATCH') {
    const b = await parseBody(req, SitePatch);
    if (!Object.keys(b).length) throw new HttpError(400, 'אין מה לעדכן');
    const [s] = await db.update(clientSites).set(b).where(own).returning();
    if (!s) throw notFound('אתר');
    return json({ site: siteView(s) });
  }
  if (req.method === 'DELETE') {
    const [used] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.siteId, siteId)).limit(1);
    if (used) throw new HttpError(409, 'האתר בשימוש. אפשר להסתיר אותו');
    const [s] = await db.delete(clientSites).where(own).returning({ id: clientSites.id });
    if (!s) throw notFound('אתר');
    return json({ ok: true });
  }
  throw new HttpError(405, 'Method not allowed');
});

export const config: Config = {
  path: ['/api/clients', '/api/clients/:id', '/api/clients/:id/sites', '/api/clients/:id/sites/:siteId'],
};
