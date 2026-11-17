// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Summary } from '../../src/lib/submissions';

vi.mock('../../src/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'a', username: 'a', displayName: 'מנהל', role: 'admin', hasSignature: true } }),
}));

const row = (over: Partial<Summary>): Summary => ({
  id: crypto.randomUUID(),
  formId: 'aerosol',
  status: 'emailed',
  testNumber: 'T-1',
  siteName: 'אתר',
  revision: 0,
  parentId: null,
  reviewNote: null,
  sendError: null,
  mailLogged: false,
  hasPdf: true,
  hasChild: false,
  inspectorId: 'i',
  inspectorName: 'בודק',
  submittedAt: '2026-11-17T08:00:00.000Z',
  emailedAt: '2026-11-17T09:00:00.000Z',
  createdAt: '2026-11-17T08:00:00.000Z',
  updatedAt: '2026-11-17T09:00:00.000Z',
  ...over,
});

const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

async function renderAll(mode: 'log' | 'live', rows: Summary[]) {
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.startsWith('/api/settings')) return reply({ settings: { mailMode: mode } });
      if (url.startsWith('/api/users')) return reply({ users: [] });
      return reply({ submissions: rows });
    }),
  );
  const { AllSubmissions } = await import('../../src/pages/admin/AllSubmissions');
  render(
    <MemoryRouter>
      <AllSubmissions />
    </MemoryRouter>,
  );
  await screen.findByTestId('all-list');
}

beforeEach(() => cleanup());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('mail test mode', () => {
  test('log mode shows the banner and a badge on logged rows, no resend yet', async () => {
    await renderAll('log', [row({ siteName: 'נרשם', mailLogged: true }), row({ siteName: 'נשלח' })]);
    expect(await screen.findByText('מצב בדיקה: מיילים אינם נשלחים')).toBeInTheDocument();
    const rows = screen.getAllByTestId('submission-row');
    const logged = rows.find((r) => r.textContent?.includes('נרשם'))!;
    const sent = rows.find((r) => r.textContent?.includes('נשלח') && !r.textContent?.includes('נרשם'))!;
    expect(within(logged).getByTestId('mail-logged')).toBeInTheDocument();
    expect(within(sent).queryByTestId('mail-logged')).toBeNull();
    expect(within(logged).queryByRole('button', { name: /שליחה חוזרת/ })).toBeNull();
  });

  test('live mode offers resend for logged rows only', async () => {
    await renderAll('live', [row({ siteName: 'נרשם', mailLogged: true }), row({ siteName: 'אחר' })]);
    const logged = screen.getAllByTestId('submission-row').find((r) => r.textContent?.includes('נרשם'))!;
    expect(await within(logged).findByRole('button', { name: /שליחה חוזרת/ })).toBeInTheDocument();
    expect(screen.queryByText('מצב בדיקה: מיילים אינם נשלחים')).toBeNull();
    const other = screen.getAllByTestId('submission-row').find((r) => r.textContent?.includes('אחר'))!;
    expect(within(other).queryByRole('button', { name: /שליחה חוזרת/ })).toBeNull();
  });
});
