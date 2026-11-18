import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserSwitch } from '@phosphor-icons/react';
import { ApiError } from '../lib/api';
import { useLoad } from '../lib/useLoad';
import { listInspectors, reassign } from '../lib/submissions';
import { Button, InspectorPicker, Sheet, cx, toast, type Inspector } from '../ui';
import { REASSIGNABLE } from '../../shared/reassign';
import type { Status } from '../../shared/status';

type Props = {
  submissionId: string;
  status: Status;
  inspectorId: string;
  inspectorName: string | null;
  /** Job forms change inspector from the job. */
  jobId?: string | null;
  /** Runs first; false cancels, e.g. unsaved edits. */
  before?: () => Promise<boolean>;
  onDone(): void;
  className?: string;
};

/** Admin: who owns the form, and moving it to another inspector. */
export function ReassignCard({ submissionId, status, inspectorId, inspectorName, jobId, before, onDone, className }: Props) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Inspector | null>(null);
  const [busy, setBusy] = useState(false);
  const can = !jobId && REASSIGNABLE.includes(status);
  const people = useLoad(() => (open ? listInspectors() : Promise.resolve(null)), open ? 'inspectors' : 'inspectors:off');

  function close() {
    if (busy) return;
    setOpen(false);
    setChoice(null);
  }

  async function confirm() {
    if (!choice || busy) return;
    setBusy(true);
    try {
      if (before && !(await before())) return;
      const r = await reassign(submissionId, choice.id);
      toast.success(`הטופס שויך ל${r.inspectorName}`);
      setOpen(false);
      setChoice(null);
      onDone();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'השיוך נכשל');
      if (e instanceof ApiError && e.status === 409) onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx('mb-5 flex items-center gap-3 rounded-box bg-surface shadow-[var(--shadow-card)] ps-4 pe-2 py-2', className)} data-testid="reassign-card">
      <UserSwitch className="size-5 shrink-0 text-muted" aria-hidden />
      <p className="min-w-0 flex-1 text-[15px] leading-snug">
        <span className="text-muted">שייך לבודק </span>
        <span className="font-semibold" data-testid="owner-name">
          {inspectorName ?? '—'}
        </span>
      </p>
      {jobId && (
        <Link to={`/jobs/${jobId}`} className="press inline-flex min-h-11 items-center rounded-ctl px-3 font-medium text-accent hover:bg-surface-2">
          לעבודה
        </Link>
      )}
      {can && (
        <Button variant="ghost" onClick={() => setOpen(true)} data-testid="reassign-open">
          שינוי
        </Button>
      )}
      <Sheet
        open={open}
        onClose={close}
        title="שיוך לבודק אחר"
        footer={
          <Button variant="primary" block size="lg" disabled={!choice} loading={busy} onClick={confirm} data-testid="reassign-confirm">
            {choice ? `שיוך ל${choice.displayName}` : 'בחר בודק'}
          </Button>
        }
      >
        <p className="mb-4 text-[15px] leading-relaxed text-muted">
          הטופס יעבור לבודק שתבחר ויופיע ברשימה שלו. {inspectorName ? `${inspectorName} לא יראה אותו יותר.` : ''}
        </p>
        {open && (
          <InspectorPicker
            label="בודק חדש"
            inline
            options={people.data ?? []}
            loading={people.loading}
            excludeId={inspectorId}
            value={choice?.id ?? ''}
            onChange={setChoice}
          />
        )}
        {people.error && <p className="mt-3 text-sm font-medium text-danger">{people.error}</p>}
      </Sheet>
    </div>
  );
}
