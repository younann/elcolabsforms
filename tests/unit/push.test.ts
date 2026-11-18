import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleted: unknown[] = [];
const sent: string[] = [];

vi.mock('web-push', () => ({
  setVapidDetails: () => {},
  sendNotification: async (sub: { endpoint: string }) => {
    sent.push(sub.endpoint);
    if (sub.endpoint === 'dead') throw Object.assign(new Error('gone'), { statusCode: 410 });
  },
}));

vi.mock('../../server/db/client', () => {
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const k of ['from', 'innerJoin', 'where']) c[k] = () => c;
    c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return c;
  };
  const results = [
    [{ id: 'j', plannedDate: '2026-11-24', clientName: 'מגדלי הים', siteName: 'בניין A' }],
    [
      { id: 's1', endpoint: 'dead', p256dh: 'p', auth: 'a' },
      { id: 's2', endpoint: 'live', p256dh: 'p', auth: 'a' },
    ],
  ];
  let i = 0;
  const col = (n: string) => n;
  return {
    schema: new Proxy({}, { get: () => new Proxy({}, { get: (_t, k) => col(String(k)) }) }),
    getDb: () => ({
      select: () => chain(results[i++ % 2]),
      delete: () => ({ where: (w: unknown) => (deleted.push(w), Promise.resolve()) }),
    }),
  };
});

const { pushPayload, notifyJob } = await import('../../server/push');

describe('push', () => {
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:x@y.z';
  });

  it('builds the payload', () => {
    const p = pushPayload('created', { id: 'j', clientName: 'מגדלי הים', siteName: 'בניין A', plannedDate: '2026-11-24' });
    expect(p.title).toBe('עבודה חדשה');
    expect(p.body).toContain('מגדלי הים');
    expect(p.body).toContain('בניין A');
    expect(p.url).toBe('/jobs/j');
  });

  it('drops a dead device and still resolves', async () => {
    await expect(notifyJob('created', 'j', ['u1'])).resolves.toBeUndefined();
    expect(sent).toEqual(['dead', 'live']);
    expect(deleted).toHaveLength(1);
  });

  it('does nothing without VAPID env', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    sent.length = 0;
    await notifyJob('created', 'j', ['u1']);
    expect(sent).toEqual([]);
  });
});
