import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth';
import { listJobs } from '../../lib/jobs';
import { listSubmissions } from '../../lib/submissions';
import { useLoad } from '../../lib/useLoad';
import { cx } from '../../ui';
import { overview } from '../../../shared/overview';
import { JobRow } from './Jobs';
import { QueueList } from './Queue';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

// a count only takes colour when it needs attention
function Stat({ to, label, n, tone }: { to: string; label: string; n: number | null; tone?: 'danger' | 'warning' }) {
  const content = (
    <>
      <span className="min-w-0 flex-1 truncate text-[17px]">{label}</span>
      <span className={cx('text-[17px] font-semibold tabular-nums', n && tone === 'danger' ? 'text-danger' : n && tone === 'warning' ? 'text-warning' : 'text-muted')}>{n ?? '–'}</span>
      <CaretLeft className="size-4 shrink-0 text-muted" aria-hidden />
    </>
  );
  const cls = 'press flex min-h-12 items-center gap-3 px-4 py-2.5';
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
      <h1 className="text-[28px] leading-tight font-bold sm:text-[32px]">שלום, {user?.displayName}</h1>
      <ul className="group-list mt-5 lg:max-w-xl" data-testid="overview-stats">
        <li><Stat to="#queue" label="ממתינים לאישור" n={o?.waiting ?? null} tone="warning" /></li>
        <li><Stat to="#late" label="באיחור" n={o?.late.length ?? null} tone="danger" /></li>
        <li><Stat to="#week" label="עבודות השבוע" n={o?.week.length ?? null} /></li>
        <li><Stat to="/admin/submissions?status=returned" label="הוחזרו לבודק" n={o?.returned ?? null} /></li>
      </ul>

      {o && o.late.length > 0 && (
        <Part id="late" title="באיחור" count={o.late.length}>
          <ul className="group-list">
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
          <ul className="group-list">
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
