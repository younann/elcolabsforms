import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { listJobs } from '../../lib/jobs';
import { listSubmissions } from '../../lib/submissions';
import { useLoad } from '../../lib/useLoad';
import { cx } from '../../ui';
import { overview } from '../../../shared/overview';
import { JobRow } from './Jobs';
import { QueueList } from './Queue';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

function Stat({ to, label, n, tone }: { to: string; label: string; n: number | null; tone?: 'danger' }) {
  const content = (
    <>
      <span className={cx('block text-3xl font-semibold tabular-nums', tone && n ? 'text-danger' : '')}>{n ?? '–'}</span>
      <span className="mt-1 block text-[15px] text-muted">{label}</span>
    </>
  );
  const cls = 'press block rounded-box border border-border bg-surface px-4 py-3 transition-[transform,border-color] duration-150 hover:border-border-strong active:scale-[0.99]';
  return to.startsWith('#') ? (
    <a href={to} className={cls}>
      {content}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {content}
    </Link>
  );
}

function Part({ id, title, count, children }: { id: string; title: string; count?: number; children: ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-20">
      <h2 className="mb-3 flex items-baseline gap-2 text-lg font-semibold">
        {title}
        {count !== undefined && <span className="text-sm font-normal text-muted tabular-nums">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

/** Admin home: what needs attention. */
export function Overview() {
  const { user } = useAuth();
  const jobs = useLoad(() => listJobs(), 'jobs::');
  const subs = useLoad(() => listSubmissions(), 'subs:||');
  const o = jobs.data && subs.data ? overview(jobs.data, subs.data, today()) : null;

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">שלום, {user?.displayName}</h1>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="overview-stats">
        <Stat to="#queue" label="ממתינים לאישור" n={o?.waiting ?? null} />
        <Stat to="#week" label="עבודות השבוע" n={o?.week.length ?? null} />
        <Stat to="#late" label="באיחור" n={o?.late.length ?? null} tone="danger" />
        <Stat to="/admin/submissions?status=returned" label="הוחזרו לבודק" n={o?.returned ?? null} />
      </div>

      {o && o.late.length > 0 && (
        <Part id="late" title="באיחור" count={o.late.length}>
          <ul className="flex flex-col gap-2">
            {o.late.map((j) => (
              <li key={j.id}>
                <JobRow job={j} />
              </li>
            ))}
          </ul>
        </Part>
      )}
      {o && o.week.length > 0 && (
        <Part id="week" title="השבוע" count={o.week.length}>
          <ul className="flex flex-col gap-2">
            {o.week.map((j) => (
              <li key={j.id}>
                <JobRow job={j} />
              </li>
            ))}
          </ul>
        </Part>
      )}
      <Part id="queue" title="ממתינים לאישור">
        <QueueList />
      </Part>
    </section>
  );
}
