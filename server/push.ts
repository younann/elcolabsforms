import { sendNotification, setVapidDetails } from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { getDb, schema } from './db/client';

export type JobEvent = 'created' | 'inspector' | 'forms' | 'cancelled' | 'opened';

const TITLES: Record<JobEvent, string> = {
  created: 'עבודה חדשה',
  inspector: 'עבודה הועברה אליך',
  forms: 'נוספו טפסים לעבודה',
  cancelled: 'עבודה בוטלה',
  opened: 'עבודה נפתחה ע"י בודק',
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jerusalem' });

export function pushPayload(event: JobEvent, j: { id: string; clientName: string; siteName: string; plannedDate: string }) {
  const day = dateFmt.format(new Date(`${j.plannedDate}T12:00:00Z`));
  return { title: TITLES[event], body: `${j.clientName} · ${j.siteName} · ${day}`, url: `/jobs/${j.id}` };
}

/** Best effort: never throws. */
export async function notifyJob(event: JobEvent, jobId: string, userIds: string[]): Promise<void> {
  try {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
      console.warn('push: VAPID env missing');
      return;
    }
    if (!userIds.length) return;
    const { jobs, clients, clientSites, pushSubscriptions } = schema;
    const db = getDb();
    const [[job], subs] = await Promise.all([
      db
        .select({ id: jobs.id, plannedDate: jobs.plannedDate, clientName: clients.name, siteName: clientSites.name })
        .from(jobs)
        .innerJoin(clients, eq(clients.id, jobs.clientId))
        .innerJoin(clientSites, eq(clientSites.id, jobs.siteId))
        .where(eq(jobs.id, jobId)),
      db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds)),
    ]);
    if (!job || !subs.length) return;
    setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const body = JSON.stringify(pushPayload(event, job));
    await Promise.all(
      subs.map(async (s) => {
        try {
          await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // device gone
          if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
          else console.error('push send failed', code ?? e);
        }
      }),
    );
  } catch (e) {
    console.error('push failed', e);
  }
}
