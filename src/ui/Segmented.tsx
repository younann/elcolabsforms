import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export type SegmentTone = 'ink' | 'success' | 'danger' | 'warning' | 'accent';

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  tone?: SegmentTone;
  disabled?: boolean;
};

export type SegmentedProps<T extends string> = {
  value: NoInfer<T> | null | undefined;
  onChange(value: NoInfer<T>): void;
  options: SegmentOption<T>[];
  /** Accessible group name. */
  label: string;
  size?: 'md' | 'lg';
  disabled?: boolean;
  className?: string;
};

const selected: Record<SegmentTone, string> = {
  ink: 'bg-ink text-ink-fg',
  success: 'bg-success text-surface',
  danger: 'bg-danger text-surface',
  warning: 'bg-warning text-surface',
  accent: 'bg-accent-fill text-accent-fg',
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  disabled,
  className,
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.map((o) => !(disabled || o.disabled));
  const current = options.findIndex((o) => o.value === value);
  const focusIndex = current >= 0 ? current : enabled.indexOf(true);

  function move(from: number, step: 1 | -1) {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + step * i + options.length * i) % options.length;
      if (enabled[next]) {
        refs.current[next]?.focus();
        onChange(options[next].value);
        return;
      }
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forward || e.key === 'ArrowDown') move(index, 1);
    else if (e.key === back || e.key === 'ArrowUp') move(index, -1);
    else return;
    e.preventDefault();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx('grid auto-cols-fr grid-flow-col gap-1 rounded-ctl bg-surface-2 p-1', className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === focusIndex ? 0 : -1}
            disabled={!enabled[i]}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'press flex min-w-0 items-center justify-center rounded-[7px] px-3 text-center font-medium leading-tight',
              'transition-[transform,background-color,color] duration-150 ease-snap active:scale-[0.97]',
              'disabled:opacity-45',
              size === 'lg' ? 'min-h-12 text-[17px]' : 'min-h-11 text-base',
              on ? selected[o.tone ?? 'ink'] : 'text-text hover:bg-surface',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
