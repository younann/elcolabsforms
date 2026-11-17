// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FORMS } from '../../shared/forms';
import { FormFiller, type SubmissionRow } from '../../src/fill/FormFiller';

vi.mock('../../src/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u', username: 'u', displayName: 'בודק', role: 'inspector', hasSignature: true } }),
}));

beforeAll(() => {
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const row = (formId: string): SubmissionRow => ({
  id: '00000000-0000-4000-8000-000000000001',
  formId,
  formVersion: 1,
  status: 'draft',
  data: {},
  updatedAt: '2026-11-17T10:00:00.000Z',
  revision: 1,
});

describe('FormFiller', () => {
  test.each(FORMS.map((f) => [f.id, f] as const))('renders every field of %s', (_, def) => {
    render(<FormFiller def={def} submission={row(def.id)} initialData={{}} attachments={[]} />);
    for (const s of def.sections) expect(document.getElementById(`section-${s.id}`)).toHaveTextContent(s.title);
    for (const s of def.sections) {
      for (const f of s.fields) {
        if (f.type === 'note') continue;
        expect(document.getElementById(`field-${f.id}`), `${def.id}/${f.id}`).not.toBeNull();
      }
    }
  });

  test('answering a check updates progress and the local copy', () => {
    const def = FORMS.find((f) => f.id === 'aerosol')!;
    render(<FormFiller def={def} submission={row('aerosol')} initialData={{}} attachments={[]} />);
    const results = document.getElementById('section-results')!;
    expect(within(results).getByText('0/23')).toBeInTheDocument();
    fireEvent.click(within(results).getAllByRole('radio', { name: 'כן' })[0]);
    expect(within(results).getByText('1/23')).toBeInTheDocument();
    const local = JSON.parse(localStorage.getItem(`draft:${row('aerosol').id}`)!);
    expect(local.data.c1).toEqual({ answer: 'כן' });
  });

  test('mark rest as NA fills only unanswered checks', () => {
    const def = FORMS.find((f) => f.id === 'aerosol')!;
    render(<FormFiller def={def} submission={row('aerosol')} initialData={{ c1: { answer: 'לא' } }} attachments={[]} />);
    const results = document.getElementById('section-results')!;
    fireEvent.click(within(results).getByRole('button', { name: 'סמן את השאר כ-ב"י' }));
    expect(within(results).getByText('23/23')).toBeInTheDocument();
    expect(within(results).getAllByRole('radio', { name: 'לא' })[0]).toHaveAttribute('aria-checked', 'true');
  });

  test('approver signature is not editable by the inspector', () => {
    const def = FORMS.find((f) => f.id === 'aerosol')!;
    render(<FormFiller def={def} submission={row('aerosol')} initialData={{}} attachments={[]} />);
    const approver = document.getElementById('field-approverSignature')!;
    expect(within(approver).queryByRole('button')).toBeNull();
    expect(approver).toHaveTextContent('ייחתם על ידי המאשר');
  });
});

describe('FormFiller conflicts', () => {
  test('a device copy based on another version shows the choice and keeps both', () => {
    const def = FORMS.find((f) => f.id === 'aerosol')!;
    const sub = row('aerosol');
    localStorage.setItem(
      `draft:${sub.id}`,
      JSON.stringify({ data: { siteName: 'מקומי' }, at: 1, base: '2026-11-17T09:00:00.000Z' }),
    );
    render(<FormFiller def={def} submission={sub} initialData={{ siteName: 'שרת' }} attachments={[]} />);
    expect(screen.getByText('הטופס השתנה במכשיר אחר', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'שם האתר' })).toHaveValue('מקומי');
    fireEvent.click(screen.getByRole('button', { name: 'טען את הגרסה מהשרת' }));
    expect(screen.getByRole('textbox', { name: 'שם האתר' })).toHaveValue('שרת');
    expect(localStorage.getItem(`draft:${sub.id}`)).toBeNull();
  });

  test('read-only forms clear a stale device copy', () => {
    const def = FORMS.find((f) => f.id === 'aerosol')!;
    const sub = { ...row('aerosol'), status: 'submitted' as const };
    localStorage.setItem(`draft:${sub.id}`, JSON.stringify({ data: { siteName: 'x' }, at: 1, base: 'old' }));
    render(<FormFiller def={def} submission={sub} initialData={{}} attachments={[]} readOnly />);
    expect(localStorage.getItem(`draft:${sub.id}`)).toBeNull();
  });
});
