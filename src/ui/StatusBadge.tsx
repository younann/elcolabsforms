import { cx } from './cx';
import type { Status } from '../../shared/status';

export type SubmissionStatus = Status;

const map: Record<SubmissionStatus, { label: string; cls: string }> = {
  draft: { label: 'טיוטה', cls: 'bg-surface-2 text-muted' },
  submitted: { label: 'ממתין לאישור', cls: 'bg-info-soft text-info' },
  returned: { label: 'הוחזר לתיקון', cls: 'bg-warning-soft text-warning' },
  approved: { label: 'אושר', cls: 'bg-success-soft text-success' },
  sending: { label: 'בשליחה', cls: 'bg-info-soft text-info' },
  emailed: { label: 'נשלח', cls: 'bg-success-soft text-success' },
  send_failed: { label: 'השליחה נכשלה', cls: 'bg-danger-soft text-danger' },
};

export const statusLabel = (s: SubmissionStatus): string => map[s]?.label ?? s;

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const m = map[status] ?? map.draft;
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap',
        m.cls,
        className,
      )}
    >
      {m.label}
    </span>
  );
}
