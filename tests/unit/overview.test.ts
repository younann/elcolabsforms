import { describe, expect, test } from 'vitest';
import { myDay, overview, weekDays } from '../../shared/overview';
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

describe('myDay', () => {
  const j = (id: string, plannedDate: string, state: JobState = 'open', site = 'א') => ({ id, plannedDate, state, site: { name: site } }) as JobSummary;
  const d = myDay(
    [
      j('later', '2026-11-25'),
      j('tomorrow', '2026-11-19'),
      j('today-b', '2026-11-18', 'open', 'ב'),
      j('today-a', '2026-11-18', 'open', 'א'),
      j('late', '2026-11-16'),
      j('cancelled-open', '2026-11-18', 'cancelled-open'),
      j('done', '2026-11-18', 'done'),
      j('cancelled', '2026-11-18', 'cancelled'),
    ],
    '2026-11-18',
  );
  test('today holds late then today by site, cancelled-open last', () =>
    expect(ids(d.today)).toEqual(['late', 'today-a', 'today-b', 'cancelled-open']));
  test('tomorrow and later', () => {
    expect(ids(d.tomorrow)).toEqual(['tomorrow']);
    expect(ids(d.later)).toEqual(['later']);
  });
  test('month end rolls over', () => expect(ids(myDay([j('x', '2026-12-01')], '2026-11-30').tomorrow)).toEqual(['x']));
});

describe('weekDays', () => {
  test('sunday to friday around a wednesday', () =>
    expect(weekDays('2026-11-25')).toEqual(['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']));
  test('a sunday starts its own week', () => expect(weekDays('2026-11-22')[0]).toBe('2026-11-22'));
  test('saturday belongs to the week before', () => expect(weekDays('2026-11-28')[0]).toBe('2026-11-22'));
  test('offset moves whole weeks across months', () => expect(weekDays('2026-11-25', 1)[0]).toBe('2026-11-29'));
});
