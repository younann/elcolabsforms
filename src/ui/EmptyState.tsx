import type { ReactNode } from 'react';
import { cx } from './cx';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-box bg-surface-2 text-muted [&>svg]:size-7" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-balance">{title}</h3>
      {children && <p className="mt-1.5 max-w-[42ch] text-[15px] text-muted text-pretty">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
