// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createAutosave, flushAll, preferLocal, readLocal, type SaveStatus } from '../../src/lib/autosave';

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
