import { Tray, WarningOctagon } from '@phosphor-icons/react';
import { useLoad } from '../../lib/useLoad';
import { listSubmissions, rowHref } from '../../lib/submissions';
import { Button, EmptyState } from '../../ui';
import { ListSkeleton, SubmissionRow } from '../../components/SubmissionList';

/** Submitted forms, oldest first. */
export function QueueList() {
  const { data, error, reload } = useLoad(
    () => listSubmissions({ status: 'submitted' }).then((l) => l.sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))),
    'queue',
  );
  if (error && !data) {
    return (
      <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון" action={<Button onClick={reload}>נסה שוב</Button>}>
        {error}
      </EmptyState>
    );
  }
  if (!data) return <ListSkeleton />;
  if (data.length === 0) {
    return (
      <EmptyState icon={<Tray />} title="אין טפסים ממתינים" className="rounded-box border border-dashed border-border">
        טפסים שבודקים שולחים לאישור יופיעו כאן.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col gap-2" data-testid="queue-list">
      {data.map((s) => (
        <SubmissionRow key={s.id} s={s} href={rowHref(s, 'admin')} showInspector />
      ))}
    </ul>
  );
}
