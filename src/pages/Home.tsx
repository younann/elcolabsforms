import { useEffect, useState, type ReactNode } from 'react';
import { ClipboardText, WarningOctagon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { listSubmissions, rowHref, type Summary } from '../lib/submissions';
import { Button, EmptyState } from '../ui';
import { JobCard } from '../components/JobCard';
import { listJobs } from '../lib/jobs';
import { ListSkeleton, SubmissionRow } from '../components/SubmissionList';
import { Overview } from './admin/Overview';
import { PushCard } from '../pwa/PushCard';
import { myDay } from '../../shared/overview';

const todayIL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

const SENT_PREVIEW = 8;

export function Home() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Overview />;
  if (user?.role === 'engineer') return <EngineerHome name={user.displayName} />;
  return <InspectorHome name={user?.displayName ?? ''} />;
}

function Group({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 flex items-baseline gap-2 text-lg font-semibold">
        {title}
        {count !== undefined && <span className="text-[15px] font-medium text-muted tabular-nums">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function InspectorHome({ name }: { name: string }) {
  const { data, error, reload } = useLoad(() => listSubmissions(), 'mine');
  const jobs = useLoad(() => listJobs(), 'my-jobs');
  const today = todayIL();
  const day = myDay(jobs.data ?? [], today);
  const [allSent, setAllSent] = useState(false);
  const openJobs = jobs.data?.filter((j) => j.state === 'open').length;
  // home-screen icon count
  useEffect(() => {
    if (openJobs === undefined) return;
    void (openJobs ? navigator.setAppBadge?.(openJobs) : navigator.clearAppBadge?.())?.catch(() => {});
  }, [openJobs]);
  const by = (pred: (s: Summary) => boolean) => (data ?? []).filter(pred);
  // returned stay listed for the note; job drafts live on their card
  const returned = by((s) => s.status === 'returned');
  const drafts = by((s) => s.status === 'draft' && !s.jobId);
  const sent = by((s) => s.status !== 'draft' && s.status !== 'returned');
  const shownSent = allSent ? sent : sent.slice(0, SENT_PREVIEW);

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-[28px] leading-tight font-bold sm:text-[32px]">שלום, {name}</h1>
        <Link to="/jobs/new" className="press shrink-0 rounded-ctl bg-accent px-4 py-2.5 text-[15px] font-semibold text-accent-fg" data-testid="open-job">
          + פתיחת עבודה
        </Link>
      </div>
      <PushCard />

      {(
        [
          ['היום', day.today],
          ['מחר', day.tomorrow],
          ['בהמשך', day.later],
        ] as const
      ).map(
        ([title, list]) =>
          list.length > 0 && (
            <Group key={title} title={title} count={list.length}>
              <div className="flex flex-col gap-3">
                {list.map((j) => (
                  <JobCard key={j.id} job={j} late={j.state === 'open' && j.plannedDate < today} />
                ))}
              </div>
            </Group>
          ),
      )}
      {jobs.error && !jobs.data && (
        <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון עבודות" className="mt-6" action={<Button onClick={jobs.reload}>נסה שוב</Button>}>
          {jobs.error}
        </EmptyState>
      )}

      {error && !data ? (
        <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון את הטפסים" className="mt-6" action={<Button onClick={reload}>נסה שוב</Button>}>
          {error}
        </EmptyState>
      ) : !data ? (
        <div className="mt-9">
          <ListSkeleton />
        </div>
      ) : (
        returned.length > 0 && (
          <Group title="הוחזרו לתיקון" count={returned.length}>
            <ul className="group-list" data-testid="returned-list">
              {returned.map((s) => (
                <SubmissionRow key={s.id} s={s} href={rowHref(s, 'inspector')}>
                  {s.reviewNote && (
                    <p className="mx-3 mb-3 rounded-ctl border-s-[3px] border-warning bg-warning-soft px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap" data-testid="review-note">
                      {s.reviewNote}
                    </p>
                  )}
                </SubmissionRow>
              ))}
            </ul>
          </Group>
        )
      )}


      {data && (
        <>
          {drafts.length > 0 && (
            <Group title="טיוטות" count={drafts.length}>
              <ul className="group-list">
                {drafts.map((s) => (
                  <SubmissionRow key={s.id} s={s} href={rowHref(s, 'inspector')} />
                ))}
              </ul>
            </Group>
          )}

          <Group title="נשלחו" count={sent.length || undefined}>
            {sent.length === 0 ? (
              <EmptyState icon={<ClipboardText />} title="עדיין לא נשלחו טפסים" className="rounded-box border border-dashed border-border py-8">
                טפסים ששלחת לאישור יופיעו כאן עם הסטטוס שלהם.
              </EmptyState>
            ) : (
              <>
                <ul className="group-list">
                  {shownSent.map((s) => (
                    <SubmissionRow key={s.id} s={s} href={rowHref(s, 'inspector')} />
                  ))}
                </ul>
                {sent.length > SENT_PREVIEW && (
                  <Button variant="ghost" className="mt-2" onClick={() => setAllSent((v) => !v)}>
                    {allSent ? 'הצג פחות' : `הצג את כל ${sent.length}`}
                  </Button>
                )}
              </>
            )}
          </Group>
        </>
      )}
    </div>
  );
}

/** Engineer: forms waiting for approval, then ones already approved. */
function EngineerHome({ name }: { name: string }) {
  const { data, error, reload } = useLoad(() => listSubmissions(), 'engineer');
  const waiting = (data ?? []).filter((s) => s.status === 'engineer_review');
  const done = (data ?? []).filter((s) => s.status !== 'engineer_review');
  return (
    <div>
      <h1 className="text-[28px] leading-tight font-bold sm:text-[32px]">שלום, {name}</h1>
      <PushCard />
      {error && !data ? (
        <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון את הטפסים" className="mt-6" action={<Button onClick={reload}>נסה שוב</Button>}>
          {error}
        </EmptyState>
      ) : !data ? (
        <div className="mt-9">
          <ListSkeleton />
        </div>
      ) : (
        <>
          <Group title="ממתינים לאישורך" count={waiting.length}>
            {waiting.length === 0 ? (
              <EmptyState icon={<ClipboardText />} title="אין טפסים שממתינים לך" className="rounded-box border border-dashed border-border py-8" />
            ) : (
              <ul className="group-list" data-testid="engineer-queue">
                {waiting.map((s) => (
                  <SubmissionRow key={s.id} s={s} href={`/submissions/${s.id}`} />
                ))}
              </ul>
            )}
          </Group>
          {done.length > 0 && (
            <Group title="אישרת" count={done.length}>
              <ul className="group-list">
                {done.map((s) => (
                  <SubmissionRow key={s.id} s={s} href={`/submissions/${s.id}`} />
                ))}
              </ul>
            </Group>
          )}
        </>
      )}
    </div>
  );
}
