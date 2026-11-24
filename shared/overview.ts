import type { JobSummary } from './jobs';

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Office home numbers; dates are YYYY-MM-DD. */
export function overview(jobs: JobSummary[], subs: { status: string }[], today: string) {
  const open = jobs.filter((j) => j.state === 'open').sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const end = addDays(today, 6);
  return {
    late: open.filter((j) => j.plannedDate < today),
    week: open.filter((j) => j.plannedDate >= today && j.plannedDate <= end),
    waiting: subs.filter((s) => s.status === 'submitted').length,
    returned: subs.filter((s) => s.status === 'returned').length,
    atEngineer: subs.filter((s) => s.status === 'engineer_review').length,
    certReady: subs.filter((s) => s.status === 'engineer_approved' || s.status === 'cert_failed').length,
  };
}

/** Inspector home: open jobs by day; late first, cancelled-open last in each group. */
export function myDay(jobs: JobSummary[], today: string) {
  const tomorrow = addDays(today, 1);
  const open = jobs
    .filter((j) => j.state === 'open' || j.state === 'cancelled-open')
    .sort(
      (a, b) =>
        Number(a.state === 'cancelled-open') - Number(b.state === 'cancelled-open') ||
        a.plannedDate.localeCompare(b.plannedDate) ||
        a.site.name.localeCompare(b.site.name, 'he'),
    );
  return {
    today: open.filter((j) => j.plannedDate <= today),
    tomorrow: open.filter((j) => j.plannedDate === tomorrow),
    later: open.filter((j) => j.plannedDate > tomorrow),
  };
}

/** Sunday to Friday of the week holding `day`, shifted by `offset` weeks. */
export function weekDays(day: string, offset = 0): string[] {
  const sunday = addDays(day, -new Date(`${day}T12:00:00Z`).getUTCDay() + offset * 7);
  return [0, 1, 2, 3, 4, 5].map((i) => addDays(sunday, i));
}
