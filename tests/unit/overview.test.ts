import { describe, expect, test } from 'vitest';
import { overview } from '../../shared/overview';
import type { JobState, JobSummary } from '../../shared/jobs';

const job = (id: string, plannedDate: string, state: JobState = 'open') => ({ id, plannedDate, state }) as JobSummary;
const ids = (l: JobSummary[]) => l.map((j) => j.id);

describe('overview', () => {
  const jobs = [
    job('late', '2026-11-17'),
    job('end', '2026-11-24'),
    job('today', '2026-11-18'),
    job('next', '2026-11-25'),
    job('done', '2026-11-17', 'done'),
    job('cancelled', '2026-11-18', 'cancelled'),
    job('cancelled-open', '2026-11-10', 'cancelled-open'),
  ];
  const subs = [{ status: 'submitted' }, { status: 'submitted' }, { status: 'returned' }, { status: 'draft' }];
  const o = overview(jobs, subs, '2026-11-18');

  test('late is open jobs planned before today', () => expect(ids(o.late)).toEqual(['late']));
  test('week is open jobs from today to six days on, by date', () => expect(ids(o.week)).toEqual(['today', 'end']));
  test('counts waiting and returned forms', () => {
    expect(o.waiting).toBe(2);
    expect(o.returned).toBe(1);
  });
});
