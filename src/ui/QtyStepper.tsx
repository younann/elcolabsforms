import { Minus, Plus } from '@phosphor-icons/react';
import { cx } from './cx';

type Props = { label: string; value: number; onChange(n: number): void; max?: number; className?: string };

/** A labelled count with − / + buttons. */
export function QtyStepper({ label, value, onChange, max = 9, className }: Props) {
  const btn =
    'press grid size-11 touch-manipulation place-items-center rounded-full border border-border-strong bg-surface text-text transition-[transform,opacity] duration-150 active:scale-[0.92] disabled:opacity-35';
  return (
    <div className={cx('flex min-h-14 items-center gap-3', className)} role="group" aria-label={label}>
      <span className={cx('min-w-0 flex-1 text-[16px]', value > 0 ? 'font-semibold' : 'text-muted')}>{label}</span>
      <button type="button" className={btn} aria-label={`פחות ${label}`} disabled={value <= 0} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" weight="bold" aria-hidden />
      </button>
      <output className="w-6 text-center text-[17px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </output>
      <button type="button" className={btn} aria-label={`עוד ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" weight="bold" aria-hidden />
      </button>
    </div>
  );
}
