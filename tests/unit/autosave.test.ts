// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAutosave, flushAll, preferLocal, readLocal, sameData, type SaveStatus } from '../../src/lib/autosave';

const KEY = 'draft:test';

beforeEach(() => {
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
    expect(save).toHaveBeenCalledWith({ a: 2 });
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

describe('conflicts', () => {
  const conflictErr = () => Object.assign(new Error('stale'), { status: 409 });

  test('lost response then 409 with equal server data ends saved', async () => {
    let updatedAt = 'v0';
    const sent: string[] = [];
    // first PATCH commits but its reply is lost
    const save = vi
      .fn<(d: Record<string, unknown>) => Promise<{ updatedAt: string }>>()
      .mockImplementationOnce(async () => {
        sent.push(updatedAt);
        throw Object.assign(new Error('net'), { status: 0 });
      })
      .mockImplementationOnce(async () => {
        sent.push(updatedAt);
        throw conflictErr();
      })
      .mockImplementation(async () => {
        sent.push(updatedAt);
        return { updatedAt: 'v2' };
      });
    const onConflict = vi.fn(async (d: Record<string, unknown>) => {
      expect(d).toEqual({ x: 1 });
      updatedAt = 'v1';
      return { resolved: true as const, updatedAt: 'v1' };
    });
    const a = createAutosave({ save, storageKey: KEY, delay: 10, base: 'v0', onConflict });
    const seen: SaveStatus[] = [];
    a.subscribe((s) => seen.push(s));
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onConflict).toHaveBeenCalledOnce();
    expect(seen.at(-1)).toBe('saved');
    expect(localStorage.getItem(KEY)).toBeNull();
    // later edits save against the adopted version
    a.update({ x: 2 });
    await vi.advanceTimersByTimeAsync(100);
    expect(sent.at(-1)).toBe('v1');
    expect(seen.at(-1)).toBe('saved');
    a.dispose();
  });

  test('409 with different server data enters conflict and keeps the local copy', async () => {
    const save = vi.fn<(d: unknown) => Promise<{ updatedAt: string }>>().mockRejectedValue(conflictErr());
    const onConflict = vi.fn(async () => ({ resolved: false as const }));
    const a = createAutosave({ save, storageKey: KEY, delay: 10, onConflict });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(a.status()).toBe('conflict');
    expect(save).toHaveBeenCalledOnce();
    expect(readLocal(KEY)?.data).toEqual({ x: 1 });
    a.dispose();
  });

  test('keepMine re-saves local data on the server version', async () => {
    const save = vi
      .fn<(d: unknown) => Promise<{ updatedAt: string }>>()
      .mockRejectedValueOnce(conflictErr())
      .mockResolvedValue({ updatedAt: 'v9' });
    const a = createAutosave({ save, storageKey: KEY, delay: 10, onConflict: async () => ({ resolved: false as const }) });
    a.update({ x: 1 });
    await vi.advanceTimersByTimeAsync(100);
    expect(a.status()).toBe('conflict');
    a.keepMine('v8');
    expect(readLocal(KEY)?.base).toBe('v8');
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenLastCalledWith({ x: 1 });
    expect(a.status()).toBe('saved');
    a.dispose();
  });

  test('takeServer drops the local copy', async () => {
    const save = vi.fn<(d: unknown) => Promise<{ updatedAt: string }>>().mockRejectedValue(conflictErr());
    const a = createAutosave({ save, storageKey: KEY, delay: 10, onConflict: async () => ({ resolved: false as const }) });
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

  test('sameData ignores key order and undefined', () => {
    expect(sameData({ a: 1, b: { c: undefined, d: [1, 2] } }, { b: { d: [1, 2] }, a: 1 })).toBe(true);
    expect(sameData({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});
