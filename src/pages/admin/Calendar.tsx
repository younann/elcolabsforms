import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CaretLeft, CaretRight, Plus, WarningOctagon } from '@phosphor-icons/react';
import { listJobs, type JobSummary } from '../../lib/jobs';
import { listInspectors } from '../../lib/submissions';
import { useLoad } from '../../lib/useLoad';
import { Button, EmptyState, Select, cx } from '../../ui';
import { ListSkeleton } from '../../components/SubmissionList';
import { weekDays } from '../../../shared/overview';

const todayIL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const dayFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const dayLabel = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));
const newJobHref = (inspectorId: string, date: string) => `/admin/jobs/new?inspectorId=${inspectorId}&date=${date}`;

/** Week of jobs per inspector. */
export function Calendar() {
  const today = todayIL();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState('');
  const days = weekDays(today, offset);
  // shortcut: loads all jobs, add a date filter to /api/jobs when jobs reach the thousands
  const jobs = useLoad(() => listJobs(), 'jobs::');
  const people = useLoad(listInspectors, 'inspectors');
  const error = jobs.error ?? people.error;
  const inspectors = people.data ?? [];
  const phoneId = picked || inspectors[0]?.id || '';

  const cell = (inspectorId: string, day: string) =>
    (jobs.data ?? []).filter((j) => j.inspector.id === inspectorId && j.plannedDate === day && j.state !== 'cancelled');

  return (
    <section>
      <h1 className="text-[28px] leading-tight font-bold sm:text-[32px]">יומן</h1>

      <div className="mt-5 flex items-center gap-2">
        <Button variant="ghost" aria-label="שבוע קודם" icon={<CaretRight className="size-5" aria-hidden />} onClick={() => setOffset((o) => o - 1)}>
          <span className="max-sm:hidden">שבוע קודם</span>
        </Button>
        <Button variant="ghost" className="min-w-0 flex-1" disabled={offset === 0} onClick={() => setOffset(0)}>
          {dayLabel(days[0])} – {dayLabel(days[5])}
        </Button>
        <Button variant="ghost" aria-label="שבוע הבא" onClick={() => setOffset((o) => o + 1)}>
          <span className="max-sm:hidden">שבוע הבא</span>
          <CaretLeft className="size-5" aria-hidden />
        </Button>
      </div>

      <div className="mt-4">
        {error && !(jobs.data && people.data) ? (
          <EmptyState
            icon={<WarningOctagon />}
            title="לא ניתן לטעון"
            action={
              <Button
                onClick={() => {
                  jobs.reload();
                  people.reload();
                }}
              >
                נסה שוב
              </Button>
            }
          >
            {error}
          </EmptyState>
        ) : !jobs.data || !people.data ? (
          <ListSkeleton rows={4} />
        ) : (
          <>
            {/* phones: one inspector, days down */}
            <div className="md:hidden">
              <Select label="בודק" value={phoneId} onChange={(e) => setPicked(e.target.value)}>
                {inspectors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </Select>
              <ul className="mt-4 flex flex-col gap-3">
                {days.map((d) => (
                  <li key={d} className={cx('rounded-box bg-surface p-3 shadow-[var(--shadow-card)]', d === today && 'ring-2 ring-accent')}>
                    <p className="mb-2 text-[15px] font-semibold">{dayLabel(d)}</p>
                    <Cell jobs={cell(phoneId, d)} href={newJobHref(phoneId, d)} />
                  </li>
                ))}
              </ul>
            </div>

            {/* wider: inspectors × days */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="w-28" />
                    {days.map((d) => (
                      <th key={d} className={cx('rounded-ctl py-1.5 text-[14px] font-semibold', d === today ? 'bg-accent-soft text-accent' : 'text-muted')}>
                        {dayLabel(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inspectors.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="truncate text-start align-top text-[15px] font-semibold">
                        {p.displayName}
                      </th>
                      {days.map((d) => (
                        <td key={d} className={cx('rounded-ctl bg-surface p-1.5 align-top shadow-[var(--shadow-card)]', d === today && 'ring-2 ring-accent')}>
                          <Cell jobs={cell(p.id, d)} href={newJobHref(p.id, d)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Cell({ jobs, href }: { jobs: JobSummary[]; href: string }) {
  return (
    <div className="flex flex-col gap-1">
      {jobs.map((j) => (
        <Link
          key={j.id}
          to={`/jobs/${j.id}`}
          className={cx(
            'press block truncate rounded-ctl px-2 py-1.5 text-[14px] font-medium',
            j.state === 'open' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
          )}
        >
          {j.client.name} · {j.site.name}
          {j.state === 'cancelled-open' && ' · בוטלה'}
        </Link>
      ))}
      <Link to={href} aria-label="עבודה חדשה" className="press flex min-h-9 items-center justify-center rounded-ctl text-muted hover:bg-surface-2 hover:text-text">
        <Plus className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
