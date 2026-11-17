// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAutosave, flushAll, preferLocal, readLocal, sameData, type SaveStatus } from '../../src/lib/autosave';

// fresh key per test: per-key state is module wide
let KEY = 'draft:test';
let seq = 0;

beforeEach(() => {
  KEY = `draft:test-${++seq}`;
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const ok = () => Promise.resolve({ updatedAt: new Date().toISOString() });

describe('createAutosave', () => {
  test('update writes localStorage synchronously', () => {
    const a = createAutosave({ save: vi.fn(ok), storageKey: KEY });
    a.update({ siteName: 'מגדל' });
    expect(readLocal(KEY)?.data).toEqual({ siteName: 'מגדל' });
    a.dispose();
  });

  test('debounces server saves', async () => {
    const save = vi.fn(ok);
    const a = createAutosave({ save, storageKey: KEY, delay: 1500 });
    a.update({ a: 1 });
    a.update({ a: 2 });
    await vi.advanceTimersByTimeAsync(1400);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ a: 2 }, undefined);
    a.dispose();
  });

  test('rejecting twice then resolving ends saved with localStorage cleared', async () => {
    const save = vi
      .fn<(d: unknown) => Promise<{ updatedAt: string }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation(ok);
    const a = createAutosave({ save, storageKey: KEY, delay: 100 });
    const seen: SaveStatus[] = [];
    a.subscribe((s) => seen.push(s));
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(3);
    expect(seen.at(-1)).toBe('saved');
    expect(seen).toContain('error');
    expect(localStorage.getItem(KEY)).toBeNull();
    a.dispose();
  });

  test('network errors report offline', async () => {
    const err = Object.assign(new Error('net'), { status: 0 });
    const save = vi.fn<(d: unknown) => Promise<{ updatedAt: string }>>().mockRejectedValueOnce(err).mockImplementation(ok);
    const a = createAutosave({ save, storageKey: KEY, delay: 10 });
    const seen: SaveStatus[] = [];
    a.subscribe((s) => seen.push(s));
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(20);
    expect(seen.at(-1)).toBe('offline');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(seen.at(-1)).toBe('saved');
    a.dispose();
  });

  test('client errors stop retrying and keep the local copy', async () => {
    const err = Object.assign(new Error('conflict'), { status: 409 });
    const save = vi.fn<(d: unknown) => Promise<{ updatedAt: string }>>().mockRejectedValue(err);
    const a = createAutosave({ save, storageKey: KEY, delay: 10 });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledOnce();
    expect(readLocal(KEY)?.data).toEqual({ x: 1 });
    a.dispose();
  });

  test('403 (form no longer editable) reports locked and stops saving', async () => {
    const err = Object.assign(new Error('אין הרשאה'), { status: 403 });
    const save = vi.fn<(d: unknown) => Promise<{ updatedAt: string }>>().mockRejectedValue(err);
    const a = createAutosave({ save, storageKey: KEY, delay: 10 });
    const seen: SaveStatus[] = [];
    a.subscribe((s) => seen.push(s));
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(a.status()).toBe('locked');
    a.update({ x: 2 });
    await a.flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledOnce();
    expect(seen).toContain('locked');
    a.dispose();
  });

  test('keeps the local copy when edits arrive mid-save', async () => {
    let release!: () => void;
    const save = vi.fn(() => new Promise<{ updatedAt: string }>((r) => (release = () => r({ updatedAt: 'x' }))));
    const a = createAutosave({ save, storageKey: KEY, delay: 10 });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(20);
    a.update({ x: 2 });
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(readLocal(KEY)?.data).toEqual({ x: 2 });
    a.dispose();
  });

  test('flush resolves after the pending save completes', async () => {
    let done = false;
    const save = vi.fn(
      () =>
        new Promise<{ updatedAt: string }>((r) =>
          setTimeout(() => {
            done = true;
            r({ updatedAt: 'x' });
          }, 500),
        ),
    );
    const a = createAutosave({ save, storageKey: KEY, delay: 1500 });
    a.update({ x: 1 });
    const p = a.flush();
    expect(save).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(500);
    await p;
    expect(done).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
    a.dispose();
  });

  test('flush never throws', async () => {
    const a = createAutosave({ save: () => Promise.reject(new Error('down')), storageKey: KEY });
    a.update({ x: 1 });
    await expect(a.flush()).resolves.toBeUndefined();
    expect(readLocal(KEY)?.data).toEqual({ x: 1 });
    a.dispose();
  });

  test('flushAll on expired session does not wait on the stuck save', async () => {
    const save = vi.fn(() => new Promise<{ updatedAt: string }>(() => {}));
    const a = createAutosave({ save, storageKey: KEY, delay: 10 });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(20);
    await expect(flushAll({ expired: true })).resolves.toBeUndefined();
    expect(readLocal(KEY)?.data).toEqual({ x: 1 });
    a.dispose();
  });
});

describe('preferLocal', () => {
  test('uses the local copy when newer than the server', () => {
    localStorage.setItem(KEY, JSON.stringify({ data: { a: 'local' }, at: Date.parse('2026-11-17T10:00:05Z') }));
    expect(preferLocal(KEY, { a: 'server' }, '2026-11-17T10:00:00Z')).toEqual({ data: { a: 'local' }, fromLocal: true });
  });

  test('drops a stale local copy', () => {
    localStorage.setItem(KEY, JSON.stringify({ data: { a: 'local' }, at: Date.parse('2026-11-17T09:00:00Z') }));
    expect(preferLocal(KEY, { a: 'server' }, '2026-11-17T10:00:00Z')).toEqual({ data: { a: 'server' }, fromLocal: false });
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('local copy base', () => {
  test('edits made during a save survive a reload', async () => {
    vi.setSystemTime(Date.parse('2026-11-17T10:00:00Z'));
    let release!: () => void;
    const save = vi.fn(() => new Promise<{ updatedAt: string }>((r) => (release = () => r({ updatedAt: '2026-11-17T10:00:09Z' }))));
    const a = createAutosave({ save, storageKey: KEY, delay: 10, base: '2026-11-17T09:00:00Z' });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(20);
    a.update({ x: 2 });
    release();
    await vi.advanceTimersByTimeAsync(0);
    a.dispose();
    // server clock ahead of the device
    expect(preferLocal(KEY, { x: 1 }, '2026-11-17T10:00:09Z')).toEqual({ data: { x: 2 }, fromLocal: true });
  });
});

// fake server: PATCH needs the current version, like the real API
function fakeServer(start = '2026-11-17T10:00:00.000Z') {
  let n = 0;
  const srv = { data: {} as Record<string, unknown>, updatedAt: start, patches: [] as string[] };
  const next = () => new Date(Date.parse(start) + ++n * 1000).toISOString();
  const save = vi.fn(async (d: Record<string, unknown>, base?: string) => {
    srv.patches.push(base ?? '');
    if (base !== srv.updatedAt) throw Object.assign(new Error('stale'), { status: 409 });
    srv.data = structuredClone(d);
    srv.updatedAt = next();
    return { updatedAt: srv.updatedAt };
  });
  const fetchServer = vi.fn(async () => ({ data: structuredClone(srv.data), updatedAt: srv.updatedAt }));
  return { srv, save, fetchServer };
}

describe('conflicts', () => {
  const conflictErr = () => Object.assign(new Error('stale'), { status: 409 });

  test('lost response then 409 with our data on the server ends saved', async () => {
    const { srv, save, fetchServer } = fakeServer();
    // first PATCH commits but its reply is lost
    save.mockImplementationOnce(async (d) => {
      srv.data = structuredClone(d);
      srv.updatedAt = '2026-11-17T10:00:05.000Z';
      throw Object.assign(new Error('net'), { status: 0 });
    });
    const onConflict = vi.fn();
    const a = createAutosave({ save, storageKey: KEY, delay: 10, base: srv.updatedAt, fetchServer, onConflict });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onConflict).not.toHaveBeenCalled();
    expect(a.status()).toBe('saved');
    expect(localStorage.getItem(KEY)).toBeNull();
    a.update({ x: 2 });
    await vi.advanceTimersByTimeAsync(100);
    expect(a.status()).toBe('saved');
    expect(srv.data).toEqual({ x: 2 });
    a.dispose();
  });

  test('two instances on one key (remount while a slow save runs) do not conflict', async () => {
    const { srv, save, fetchServer } = fakeServer();
    const base = srv.updatedAt;
    save.mockImplementationOnce(async (d, b) => {
      await new Promise((r) => setTimeout(r, 3000));
      srv.patches.push(b ?? '');
      srv.data = structuredClone(d);
      srv.updatedAt = '2026-11-17T10:00:09.000Z';
      return { updatedAt: srv.updatedAt };
    });
    const onConflict = vi.fn();
    const first = createAutosave({ save, storageKey: KEY, delay: 1500, base, fetchServer, onConflict });
    first.update({ siteName: 'א' });
    // unmount: flush starts the slow save, new instance mounts with the stale base
    const flushing = first.flush();
    first.dispose();
    const second = createAutosave({ save, storageKey: KEY, delay: 1500, base, fetchServer, onConflict });
    second.update({ siteName: 'א' });
    await vi.advanceTimersByTimeAsync(1600);
    second.update({ siteName: 'א', siteAddress: 'ב' });
    await vi.advanceTimersByTimeAsync(10_000);
    await flushing;
    expect(onConflict).not.toHaveBeenCalled();
    expect(second.status()).toBe('saved');
    expect(srv.data).toEqual({ siteName: 'א', siteAddress: 'ב' });
    second.dispose();
  });

  test('409 with someone else\'s data enters conflict and keeps the local copy', async () => {
    const { srv, save, fetchServer } = fakeServer();
    const base = srv.updatedAt;
    srv.data = { x: 'other device' };
    srv.updatedAt = '2026-11-17T11:00:00.000Z';
    const onConflict = vi.fn();
    const a = createAutosave({ save, storageKey: KEY, delay: 10, base, fetchServer, onConflict });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(a.status()).toBe('conflict');
    expect(onConflict).toHaveBeenCalledWith({ data: { x: 'other device' }, updatedAt: '2026-11-17T11:00:00.000Z' });
    expect(save).toHaveBeenCalledOnce();
    expect(readLocal(KEY)?.data).toEqual({ x: 1 });
    a.dispose();
  });

  test('keepMine re-saves local data on the server version', async () => {
    const save = vi
      .fn<(d: unknown, base?: string) => Promise<{ updatedAt: string }>>()
      .mockRejectedValueOnce(conflictErr())
      .mockResolvedValue({ updatedAt: 'v9' });
    const fetchServer = async () => ({ data: { x: 'other' } as Record<string, unknown>, updatedAt: 'v8' });
    const a = createAutosave<Record<string, unknown>>({ save, storageKey: KEY, delay: 10, fetchServer });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(100);
    expect(a.status()).toBe('conflict');
    a.keepMine('v8');
    expect(readLocal(KEY)?.base).toBe('v8');
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenLastCalledWith({ x: 1 }, 'v8');
    expect(a.status()).toBe('saved');
    a.dispose();
  });

  test('takeServer drops the local copy', async () => {
    const save = vi.fn<(d: unknown) => Promise<{ updatedAt: string }>>().mockRejectedValue(conflictErr());
    const a = createAutosave<Record<string, unknown>>({
      save,
      storageKey: KEY,
      delay: 10,
      fetchServer: async () => ({ data: { y: 1 }, updatedAt: 'v5' }),
    });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(100);
    a.takeServer('v5');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(a.status()).toBe('saved');
    a.dispose();
  });

  test('after an expired flush, unmount flush does not save again', async () => {
    const save = vi.fn(ok);
    const a = createAutosave({ save, storageKey: KEY, delay: 1000 });
    a.update({ x: 1 });
    await flushAll({ expired: true });
    await a.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(readLocal(KEY)?.data).toEqual({ x: 1 });
    a.dispose();
  });
});

describe('preferLocal with a different base', () => {
  test('keeps a local copy with different data and reports the conflict', () => {
    localStorage.setItem(KEY, JSON.stringify({ data: { a: 'local' }, at: Date.parse('2026-11-17T09:00:00Z'), base: '2026-11-17T08:00:00Z' }));
    const r = preferLocal(KEY, { a: 'server' }, '2026-11-17T10:00:00Z');
    expect(r).toEqual({ data: { a: 'server' }, fromLocal: false, conflict: { a: 'local' } });
    expect(readLocal(KEY)?.data).toEqual({ a: 'local' });
  });

  test('drops a local copy equal to the server data, whatever the key order', () => {
    localStorage.setItem(KEY, JSON.stringify({ data: { b: 1, a: { y: 2, x: 1 } }, at: 1, base: 'old' }));
    expect(preferLocal(KEY, { a: { x: 1, y: 2 }, b: 1 }, '2026-11-17T10:00:00Z')).toEqual({
      data: { a: { x: 1, y: 2 }, b: 1 },
      fromLocal: false,
    });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  test('reload after a save whose reply was lost keeps the newer local edits', async () => {
    // page 1: save of {a} reaches the server, reply lost; then {a,b} typed
    const { srv, save } = fakeServer();
    const base = srv.updatedAt;
    save.mockImplementationOnce(async (d) => {
      srv.data = structuredClone(d);
      srv.updatedAt = '2026-11-17T10:00:07.000Z';
      return new Promise(() => {});
    });
    const a = createAutosave({ save, storageKey: KEY, delay: 10, base });
    a.update({ siteName: 'א' });
    await vi.advanceTimersByTimeAsync(20);
    a.update({ siteName: 'א', siteAddress: 'ב' });
    a.dispose();
    // page 2 loads the server copy
    const r = preferLocal(KEY, srv.data, srv.updatedAt);
    expect(r).toEqual({ data: { siteName: 'א', siteAddress: 'ב' }, fromLocal: true });
    expect(readLocal(KEY)?.base).toBe(srv.updatedAt);
  });

  test('sameData ignores key order and undefined', () => {
    expect(sameData({ a: 1, b: { c: undefined, d: [1, 2] } }, { b: { d: [1, 2] }, a: 1 })).toBe(true);
    expect(sameData({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});
