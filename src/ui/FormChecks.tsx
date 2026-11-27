import { Check } from '@phosphor-icons/react';
import { FORMS } from '../../shared/forms';
import { cx } from './cx';

type Props = { value: string[]; onChange(ids: string[]): void; disabled?: string[]; label?: string };

/** One checkbox per form type. */
export function FormChecks({ value, onChange, disabled = [], label = 'טפסים' }: Props) {
  return (
    <fieldset>
      {label && <legend className="text-[15px] font-medium">{label}</legend>}
      <div className="mt-1 divide-y divide-border">
        {FORMS.map((f) => {
          const off = disabled.includes(f.id);
          const on = off || value.includes(f.id);
          return (
            <label key={f.id} className={cx('flex min-h-14 cursor-pointer items-center gap-3', off && 'cursor-default opacity-50')}>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={on}
                disabled={off}
                onChange={(e) => onChange(e.target.checked ? [...value, f.id] : value.filter((x) => x !== f.id))}
              />
              <span
                aria-hidden
                className={cx(
                  'grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
                  on ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong bg-surface',
                )}
              >
                {on && <Check className="size-4" weight="bold" />}
              </span>
              <span className={cx('min-w-0 flex-1 text-[16px]', on ? 'font-semibold' : 'text-muted')}>{f.shortTitle}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
