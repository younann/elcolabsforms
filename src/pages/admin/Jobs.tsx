import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, CaretLeft, Plus, WarningOctagon } from '@phosphor-icons/react';
import { jobDate, listJobs, type JobSummary } from '../../lib/jobs';
import { listClients } from '../../lib/clients';
import { listInspectors } from '../../lib/submissions';
import { useLoad } from '../../lib/useLoad';
import { Button, EmptyState, Select, cx } from '../../ui';
import { ListSkeleton } from '../../components/SubmissionList';
import type { JobState } from '../../../shared/jobs';

const GROUPS: { state: JobState; title: string }[] = [
  { state: 'open', title: 'פתוחות' },
  { state: 'cancelled-open', title: 'בוטלו, עם טפסים פתוחים' },
  { state: 'done', title: 'הושלמו' },
  { state: 'cancelled', title: 'בוטלו' },
];

export function Jobs() {
  const navigate = useNavigate();
  const [inspectorId, setInspectorId] = useState('');
  const [clientId, setClientId] = useState('');
  const { data, error, reload } = useLoad(() => listJobs({ inspectorId, clientId }), `jobs:${inspectorId}:${clientId}`);
  const people = useLoad(listInspectors, 'inspectors');
  const clients = useLoad(listClients, 'clients');

  return (
    <section>
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-[28px] leading-tight font-bold sm:text-[32px]">עבודות</h1>
        <Button variant="accent" icon={<Plus className="size-5" weight="bold" aria-hidden />} onClick={() => navigate('/admin/jobs/new')}>
          עבודה חדשה
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Select label="בודק" value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}>
          <option value="">כולם</option>
          {people.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </Select>
        <Select label="לקוח" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">כולם</option>
          {clients.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6">
        {error && !data ? (
          <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון" action={<Button onClick={reload}>נסה שוב</Button>}>
            {error}
          </EmptyState>
        ) : !data ? (
          <ListSkeleton rows={4} />
        ) : data.length === 0 ? (
          <EmptyState icon={<Briefcase />} title="אין עבודות" />
        ) : (
          <JobGroups jobs={data} />
        )}
      </div>
    </section>
  );
}

/** Jobs split by state, open first. */
export function JobGroups({ jobs }: { jobs: JobSummary[] }) {
  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map((g) => {
        const list = jobs.filter((j) => j.state === g.state);
        if (!list.length) return null;
        return (
          <div key={g.state}>
            <h2 className="mb-3 flex items-baseline gap-2 text-lg font-semibold">
              {g.title}
              <span className="text-sm font-normal text-muted">{list.length}</span>
            </h2>
            <ul className="group-list">
              {list.map((j) => (
                <li key={j.id}>
                  <JobRow job={j} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function JobRow({ job }: { job: JobSummary }) {
  const pending = job.forms.filter((f) => f.status === 'draft' || f.status === 'returned').length;
  const dim = job.state === 'done' || job.state === 'cancelled';
  return (
    <Link
      to={`/jobs/${job.id}`}
      className={cx(
        'press flex min-h-[4.25rem] w-full items-center gap-3 rounded-box bg-surface shadow-[var(--shadow-card)] px-4 py-3 transition-[transform,border-color] duration-150 ease-snap hover:border-border-strong active:scale-[0.99]',
        dim && 'bg-surface-2/50',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[17px] font-semibold', dim && 'text-muted')}>
          {job.client.name} · {job.site.name}
        </span>
        <span className="block truncate text-sm text-muted">
          {jobDate(job.plannedDate)} · {job.inspector.displayName} · {job.forms.length === 1 ? 'טופס אחד' : `${job.forms.length} טפסים`}{pending ? `, ${pending} פתוחים` : ''}
        </span>
      </span>
      <CaretLeft className="size-4 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
