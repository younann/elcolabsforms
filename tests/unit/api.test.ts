import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api, ApiError, setUnauthorizedHandler } from '../../src/lib/api';
import { registerFlush } from '../../src/lib/autosave';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let restore: () => void;
let redirected: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  redirected = vi.fn<() => void>();
  restore = setUnauthorizedHandler(redirected);
});

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

describe('api', () => {
  test('sends JSON with credentials and parses the reply', async () => {
    fetchMock.mockResolvedValue(json({ ok: 1 }));
    const r = await api<{ ok: number }>('/api/x', { method: 'POST', json: { a: 1 } });
    expect(r).toEqual({ ok: 1 });
    const [path, init = {}] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/x');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  test('throws ApiError with the server message', async () => {
    fetchMock.mockResolvedValue(json({ error: 'נתונים לא תקינים', issues: [] }, 400));
    const err = (await api('/api/x').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('נתונים לא תקינים');
    expect(err.body.issues).toEqual([]);
    expect(redirected).not.toHaveBeenCalled();
  });

  test('401 flushes autosave before routing to login', async () => {
    const order: string[] = [];
    const off = registerFlush(async () => {
      order.push('flush');
    });
    redirected.mockImplementation(() => {
      order.push('redirect');
    });
    fetchMock.mockResolvedValue(json({ error: 'נדרשת התחברות' }, 401));
    await expect(api('/api/submissions')).rejects.toMatchObject({ status: 401 });
    expect(order).toEqual(['flush', 'redirect']);
    off();
  });

  test('401 from login does not redirect', async () => {
    fetchMock.mockResolvedValue(json({ error: 'שם משתמש או סיסמה שגויים' }, 401));
    await expect(api('/api/auth/login', { method: 'POST', json: {} })).rejects.toMatchObject({ status: 401 });
    expect(redirected).not.toHaveBeenCalled();
  });

  test('network failure becomes status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/api/x')).rejects.toMatchObject({ status: 0 });
  });

  test('204 resolves undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api('/api/x')).resolves.toBeUndefined();
  });
});
