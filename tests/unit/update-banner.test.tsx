// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { calls, updateServiceWorker, flushAll } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    updateServiceWorker: vi.fn(async (_reload?: boolean) => {
      calls.push('update');
    }),
    flushAll: vi.fn(async () => {
      calls.push('flush');
    }),
  };
});

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));
vi.mock('../../src/lib/autosave', () => ({ flushAll }));

import { UpdateBanner } from '../../src/pwa/UpdateBanner';

beforeEach(() => {
  calls.length = 0;
  updateServiceWorker.mockClear();
  flushAll.mockClear();
});
afterEach(cleanup);

describe('UpdateBanner', () => {
  test('flushes autosave before updating the service worker', async () => {
    render(<UpdateBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'עדכן עכשיו' }));
    await waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true));
    expect(calls).toEqual(['flush', 'update']);
  });
});
