// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { isStuck, rowHref, type Summary } from '../../src/lib/submissions';

const auth = vi.hoisted(() => ({
  user: { id: 'me', username: 'me', displayName: 'דנה', role: 'inspector' as 'inspector' | 'admin', hasSignature: true },
}));
vi.mock('../../src/lib/auth', () => ({ useAuth: () => ({ ...auth, logout: async () => {} }) }));
vi.mock('../../src/pwa/InstallBanner', () => ({ InstallBanner: () => null }));

const { Home } = await import('../../src/pages/Home');
const { AppShell } = await import('../../src/ui/AppShell');

const sum = (over: Partial<Summary>): Summary => ({
  id: crypto.randomUUID(),
  formId: 'aerosol',
  status: 'draft',
  testNumber: null,
  siteName: 'אתר',
  revision: 0,
  parentId: null,
  reviewNote: null,
  sendError: null,
  mailLogged: false,
  hasPdf: false,
  hasChild: false,
  inspectorId: 'me',
  inspectorName: 'דנה',
  submittedAt: null,
  emailedAt: null,
  createdAt: '2026-11-17T08:00:00.000Z',
  updatedAt: '2026-11-17T08:00:00.000Z',
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  auth.user.role = 'inspector';
});

const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

describe('submission helpers', () => {
  test('rows open where each role can act', () => {
    expect(rowHref({ id: 'a', status: 'returned' }, 'inspector')).toBe('/fill/a');
    expect(rowHref({ id: 'a', status: 'submitted' }, 'inspector')).toBe('/submissions/a');
    expect(rowHref({ id: 'a', status: 'submitted' }, 'admin')).toBe('/admin/review/a');
    expect(rowHref({ id: 'a', status: 'emailed' }, 'admin')).toBe('/submissions/a');
  });

  test('sending counts as stuck after 15 minutes', () => {
    const now = Date.parse('2026-11-17T10:00:00Z');
    expect(isStuck({ status: 'sending', updatedAt: '2026-11-17T09:50:00Z' }, now)).toBe(false);
    expect(isStuck({ status: 'sending', updatedAt: '2026-11-17T09:40:00Z' }, now)).toBe(true);
    expect(isStuck({ status: 'send_failed', updatedAt: '2026-11-17T09:00:00Z' }, now)).toBe(false);
  });
});

describe('inspector home', () => {
  test('groups returned with the note, drafts and sent, plus the five form cards', async () => {
    fetchMock.mockResolvedValue(
      reply({
        submissions: [
          sum({ status: 'returned', siteName: 'מגדל א', reviewNote: 'חסרה תמונה של הלוח' }),
          sum({ status: 'draft', siteName: 'טיוטה ב' }),
          sum({ status: 'emailed', siteName: 'נשלח ג', hasPdf: true }),
        ],
      }),
    );
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const returned = await screen.findByTestId('returned-list');
    expect(within(returned).getByText('מגדל א')).toBeInTheDocument();
    expect(within(returned).getByTestId('review-note')).toHaveTextContent('חסרה תמונה של הלוח');
    expect(within(returned).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^\/fill\//));
    expect(screen.getByRole('heading', { name: /טיוטות/ })).toBeInTheDocument();
    expect(screen.getByText('נשלח ג').closest('a')).toHaveAttribute('href', expect.stringMatching(/^\/submissions\//));
    expect(screen.getByRole('button', { name: 'שכפול' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /ארוסול|גז|גלאים|1220|536/ }).length).toBeGreaterThanOrEqual(5);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/submissions');
  });
});

describe('app shell', () => {
  const shell = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<AppShell />} />
        </Routes>
      </MemoryRouter>,
    );

  test('admin gets the admin tabs', () => {
    auth.user.role = 'admin';
    shell('/');
    const navs = screen.getAllByRole('navigation', { name: 'ניווט ראשי', hidden: true });
    const labels = within(navs[navs.length - 1]).getAllByRole('link').map((a) => a.textContent);
    expect(labels).toEqual(['לאישור', 'כל הטפסים', 'משתמשים', 'הגדרות', 'פרופיל']);
  });

  test('task pages hide the bottom tab bar', () => {
    shell('/fill/abc');
    expect(screen.getAllByRole('navigation', { name: 'ניווט ראשי', hidden: true })).toHaveLength(1);
    cleanup();
    shell('/');
    expect(screen.getAllByRole('navigation', { name: 'ניווט ראשי', hidden: true })).toHaveLength(2);
  });
});
