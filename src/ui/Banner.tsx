import type { ReactNode } from 'react';
import { CheckCircle, Info, Warning, WarningOctagon, X } from '@phosphor-icons/react';
import { cx } from './cx';

export type Tone = 'info' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: 'bg-info-soft border-info/25', icon: 'text-info', Icon: Info },
  success: { box: 'bg-success-soft border-success/25', icon: 'text-success', Icon: CheckCircle },
  warning: { box: 'bg-warning-soft border-warning/25', icon: 'text-warning', Icon: Warning },
  danger: { box: 'bg-danger-soft border-danger/25', icon: 'text-danger', Icon: WarningOctagon },
};

export type BannerProps = {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?(): void;
  className?: string;
};

export function Banner({ tone = 'info', title, children, action, onDismiss, className }: BannerProps) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-box border px-4 py-3', t.box, className)}
    >
      <t.Icon className={cx('mt-0.5 size-5 shrink-0', t.icon)} weight="fill" aria-hidden />
      <div className="min-w-0 flex-1 text-[15px] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'text-muted' : undefined}>{children}</div>}
        {action && <div className="mt-2.5 flex flex-wrap gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="סגירה"
          className="press -me-2 -mt-1.5 grid size-11 shrink-0 place-items-center rounded-full text-muted transition-transform duration-150 active:scale-[0.94]"
        >
          <X className="size-4" weight="bold" aria-hidden />
        </button>
      )}
    </div>
  );
}
