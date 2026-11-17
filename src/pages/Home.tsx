import { useState, type ReactNode } from 'react';
import { ClipboardText, WarningOctagon } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { useLoad } from '../lib/useLoad';
import { listSubmissions, rowHref, type Summary } from '../lib/submissions';
import { Button, EmptyState } from '../ui';
import { FormPicker } from '../components/FormPicker';
import { ListSkeleton, SubmissionRow } from '../components/SubmissionList';
import { DuplicateButton } from '../components/DuplicateButton';
import { QueueList } from './admin/Queue';

const SENT_PREVIEW = 8;

export function Home() {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return (
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">שלום, {user.displayName}</h1>
        <p className="mt-1 text-[15px] text-muted">טפסים שממתינים לאישור שלך</p>
        <div className="mt-6">
          <QueueList />
        </div>
      </section>
    );
  }
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
  const [allSent, setAllSent] = useState(false);
  const by = (pred: (s: Summary) => boolean) => (data ?? []).filter(pred);
  const returned = by((s) => s.status === 'returned');
  const drafts = by((s) => s.status === 'draft');
  const sent = by((s) => s.status !== 'draft' && s.status !== 'returned');
  const shownSent = allSent ? sent : sent.slice(0, SENT_PREVIEW);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">שלום, {name}</h1>

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
            <ul className="flex flex-col gap-2" data-testid="returned-list">
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

      <Group title="טופס חדש">
        <FormPicker />
      </Group>

      {data && (
        <>
          {drafts.length > 0 && (
            <Group title="טיוטות" count={drafts.length}>
              <ul className="flex flex-col gap-2">
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
                <ul className="flex flex-col gap-2">
                  {shownSent.map((s) => (
                    <SubmissionRow key={s.id} s={s} href={rowHref(s, 'inspector')} actions={<DuplicateButton id={s.id} />} />
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
