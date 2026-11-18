import type { JobSummary } from './jobs';

function addDays(day: string, n: number) {
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
  };
}
