// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WhatsAppButton } from '../../src/components/WhatsAppButton';
import type { JobView } from '../../shared/jobs';

const job = (phone: string | null): JobView => ({
  id: 'j1',
  client: { id: 'c', name: 'מגדלי הים', contactPerson: 'יוסי', phone: '0501112222' },
  site: { id: 's', name: 'בניין A', address: 'הרצל 12' },
  inspector: { id: 'i', displayName: 'דנה', phone },
  plannedDate: '2026-11-24',
  note: null,
  cancelledAt: null,
  state: 'open',
  openedByInspector: false,
  canManage: true,
  forms: [{ id: 'f', formId: 'gas', jobCopy: 1, status: 'draft', inspectorId: 'i', label: 'גז' }],
});

afterEach(cleanup);

describe('WhatsApp button', () => {
  test('disabled with a hint when the inspector has no phone', () => {
    render(<WhatsAppButton job={job(null)} />);
    expect(screen.getByTestId('whatsapp')).toBeDisabled();
    expect(screen.getByText('חסר טלפון לבודק. הוסף אותו במשתמשים')).toBeInTheDocument();
  });

  test('links to wa.me with the normalized number and the job link', () => {
    render(<WhatsAppButton job={job('050-1234567')} />);
    const href = screen.getByTestId('whatsapp').getAttribute('href')!;
    expect(href.startsWith('https://wa.me/972501234567?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain(`${location.origin}/jobs/j1`);
  });
});
