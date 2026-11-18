import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { StatusBadge, cx } from '../ui';
import { fmtDay, formShort, type Summary } from '../lib/submissions';

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul aria-busy="true" aria-label="טוען" className="group-list">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex min-h-[4.75rem] items-center gap-3 rounded-box bg-surface shadow-[var(--shadow-card)] px-4">
          <div className="flex-1">
            <div className="h-4 w-40 rounded-full bg-surface-2" />
            <div className="mt-2.5 h-3.5 w-24 rounded-full bg-surface-2" />
          </div>
          <div className="h-6 w-16 rounded-full bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}

export type RowProps = {
  s: Summary;
  href: string;
  showInspector?: boolean;
  /** Buttons at the row's end. */
  actions?: ReactNode;
  children?: ReactNode;
};

const dateOf = (s: Summary) => s.emailedAt ?? s.submittedAt ?? s.updatedAt;

/** One submission as a tappable card. */
export function SubmissionRow({ s, href, showInspector, actions, children }: RowProps) {
  const title = s.siteName || 'ללא שם אתר';
  return (
    <li className="rounded-box bg-surface shadow-[var(--shadow-card)] transition-[border-color] duration-150 hover:border-border-strong" data-testid="submission-row" data-id={s.id}>
      <div className="flex items-stretch">
        <Link
          to={href}
          className="press flex min-h-[4.75rem] min-w-0 flex-1 items-center gap-3 rounded-box px-4 py-3 transition-transform duration-150 ease-snap active:scale-[0.99]"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-[17px] font-semibold">{title}</span>
              {s.revision > 0 && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-muted tabular-nums" dir="ltr">
                  Rev {s.revision}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {[formShort(s.formId), s.testNumber && `מס' ${s.testNumber}`, showInspector && s.inspectorName, fmtDay(dateOf(s))]
                .filter(Boolean)
                .join('  |  ')}
            </span>
          </span>
          <StatusBadge status={s.status} className="shrink-0" />
          <CaretLeft className="size-4 shrink-0 text-muted max-sm:hidden" aria-hidden />
        </Link>
      </div>
      {children}
      {actions && <div className={cx('flex flex-wrap gap-2 border-t border-border px-3 py-2')}>{actions}</div>}
    </li>
  );
}
