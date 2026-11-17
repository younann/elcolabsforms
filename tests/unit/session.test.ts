import { describe, expect, test, vi } from 'vitest';

const DAY = 86_400_000;
let expiresAt = new Date();
const updates: unknown[] = [];

vi.mock('../../server/db/client', () => {
  const chain = (result: () => unknown) => {
    const c: Record<string, unknown> = {};
    for (const k of ['from', 'innerJoin', 'where', 'set']) c[k] = () => c;
    c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
    return c;
  };
  const user = { id: 'u1', username: 'u', displayName: 'U', role: 'inspector', active: true, signatureKey: null };
  return {
    schema: { sessions: { id: 'id', userId: 'user_id', expiresAt: 'expires_at' }, users: { id: 'id' } },
    getDb: () => ({
      select: () => chain(() => [{ user, expiresAt }]),
      update: () => chain(() => updates.push(1)),
    }),
  };
});

const { handle, json } = await import('../../server/http');
const { requireUser } = await import('../../server/auth');

const sid = 'a'.repeat(64);
const call = () =>
  handle(async (req) => {
    await requireUser(req);
    return json({ ok: true });
  })(new Request('https://x/api/auth/me', { headers: { cookie: `sid=${sid}` } }), {});

describe('sliding session', () => {
  test('re-issues the cookie when the session is extended', async () => {
    expiresAt = new Date(Date.now() + 5 * DAY);
    const res = await call();
    expect(updates).toHaveLength(1);
    const c = res.headers.get('set-cookie') ?? '';
    expect(c).toContain(`sid=${sid}`);
    const exp = Date.parse(/Expires=([^;]+)/.exec(c)![1]);
    expect(exp).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  test('no cookie when the session is fresh', async () => {
    updates.length = 0;
    expiresAt = new Date(Date.now() + 25 * DAY);
    const res = await call();
    expect(updates).toHaveLength(0);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});

describe('background', () => {
  test('hands the task to waitUntil and swallows failures', async () => {
    const { background } = await import('../../server/http');
    const waitUntil = vi.fn();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    background({ waitUntil }, Promise.reject(new Error('smtp down')));
    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0][0];
    expect(err).toHaveBeenCalled();
    background(undefined, Promise.reject(new Error('x')));
    await new Promise((r) => setTimeout(r, 0));
    err.mockRestore();
  });
});
