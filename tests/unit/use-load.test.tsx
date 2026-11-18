// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { clearLoadCache, useLoad } from '../../src/lib/useLoad';

afterEach(() => {
  cleanup();
  clearLoadCache();
  vi.restoreAllMocks();
});

describe('useLoad cache', () => {
  test('shows cached data on remount before the fetch resolves', async () => {
    const first = renderHook(() => useLoad(() => Promise.resolve(['a']), 'k1'));
    await waitFor(() => expect(first.result.current.data).toEqual(['a']));
    first.unmount();
    const second = renderHook(() => useLoad(() => new Promise<string[]>(() => {}), 'k1'));
    expect(second.result.current.data).toEqual(['a']);
    expect(second.result.current.loading).toBe(true);
  });

  test('keeps cached data when refresh fails', async () => {
    const first = renderHook(() => useLoad(() => Promise.resolve(1), 'k2'));
    await waitFor(() => expect(first.result.current.data).toBe(1));
    first.unmount();
    const second = renderHook(() => useLoad(() => Promise.reject(new Error('offline')), 'k2'));
    await waitFor(() => expect(second.result.current.error).toBe('offline'));
    expect(second.result.current.data).toBe(1);
  });

  test('clearLoadCache empties memory and storage', async () => {
    const first = renderHook(() => useLoad(() => Promise.resolve('x'), 'k3'));
    await waitFor(() => expect(first.result.current.data).toBe('x'));
    expect(localStorage.getItem('load-cache')).toContain('k3');
    first.unmount();
    clearLoadCache();
    expect(localStorage.getItem('load-cache')).toBeNull();
    const second = renderHook(() => useLoad(() => new Promise(() => {}), 'k3'));
    expect(second.result.current.data).toBeNull();
  });

  test('survives a throwing localStorage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const { result } = renderHook(() => useLoad(() => Promise.resolve('ok'), 'k4'));
    await waitFor(() => expect(result.current.data).toBe('ok'));
  });
});
