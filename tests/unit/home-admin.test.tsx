// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { isStuck, rowHref, type Summary } from '../../src/lib/submissions';

const auth = vi.hoisted(() => ({
  user: { id: 'me', username: 'me', displayName: 'דנה', role: 'inspector' as 'inspector' | 'admin', hasSignature: true },
}));
vi.mock('../../src/lib/auth', async (orig) => ({ ...(await orig<object>()), useAuth: () => ({ ...auth, logout: async () => {} }) }));
vi.mock('../../src/pwa/InstallBanner', () => ({ InstallBanner: () => null }));

const { Home } = await import('../../src/pages/Home');
const { AppShell } = await import('../../src/ui/AppShell');

const sum = (over: Partial<Summary>): Summary => ({
  id: crypto.randomUUID(),
  formId: 'aerosol',
  jobId: null,
  jobCopy: null,
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
  const job = {
    id: 'j1',
    client: { id: 'c', name: 'מגדלי הים', contactPerson: 'יוסי', phone: '0501112222' },
    site: { id: 's', name: 'בניין A', address: 'הרצל 12' },
    inspector: { id: 'me', displayName: 'דנה', phone: null },
    plannedDate: '2026-11-24',
    note: 'להביא סולם',
    cancelledAt: null,
    state: 'open',
    forms: [
      { id: 'g1', formId: 'gas', jobCopy: 1, status: 'draft', inspectorId: 'me', label: 'גז 1' },
      { id: 'g2', formId: 'gas', jobCopy: 2, status: 'returned', inspectorId: 'me', label: 'גז 2' },
    ],
  };

  test('job cards first, then returned and drafts outside jobs, then sent', async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url).startsWith('/api/jobs')
        ? reply({ jobs: [job, { ...job, id: 'j2', state: 'done' }] })
        : reply({
            submissions: [
              sum({ status: 'returned', siteName: 'מגדל א', reviewNote: 'חסרה תמונה של הלוח' }),
              sum({ id: 'g2', status: 'returned', siteName: 'בעבודה', jobId: 'j1', jobCopy: 2 }),
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
    const cards = await screen.findAllByTestId('job-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText('גז 1').closest('a')).toHaveAttribute('href', '/fill/g1');
    expect(within(cards[0]).getByText('גז 2')).toBeInTheDocument();
    expect(within(cards[0]).getByText('להביא סולם')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'טופס חדש' })).toBeNull();

    const returned = await screen.findByTestId('returned-list');
    expect(within(returned).getByText('מגדל א')).toBeInTheDocument();
    expect(within(returned).getByText('בעבודה')).toBeInTheDocument();
    expect(within(returned).getByTestId('review-note')).toHaveTextContent('חסרה תמונה של הלוח');
    expect(screen.getByRole('heading', { name: /טיוטות/ })).toBeInTheDocument();
    expect(screen.getByText('נשלח ג').closest('a')).toHaveAttribute('href', expect.stringMatching(/^\/submissions\//));
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
    const labels = within(navs[navs.length - 1]).getAllByRole('listitem').map((li) => li.textContent);
    expect(labels).toEqual(['הבית', 'עבודות', 'טפסים', 'יומן', 'עוד']);
    // desktop side nav lists every item
    const side = within(navs[0]).getAllByRole('link').map((a) => a.textContent);
    expect(side).toEqual(['הבית', 'עבודות', 'כל הטפסים', 'יומן', 'לקוחות', 'משתמשים', 'הגדרות', 'פרופיל']);
  });

  test('task pages hide the bottom tab bar', () => {
    shell('/fill/abc');
    expect(screen.getAllByRole('navigation', { name: 'ניווט ראשי', hidden: true })).toHaveLength(1);
    cleanup();
    shell('/');
    expect(screen.getAllByRole('navigation', { name: 'ניווט ראשי', hidden: true })).toHaveLength(2);
  });
});
