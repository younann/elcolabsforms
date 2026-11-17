import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { cx } from './cx';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, id, className, children, ...rest }, ref) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={selectId} className="text-[15px] font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cx(
            'block min-h-12 w-full appearance-none truncate rounded-ctl border border-border-strong bg-surface ps-3.5 pe-10 text-[17px] text-text',
            'transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20',
          )}
          {...rest}
        >
          {children}
        </select>
        <CaretDown className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-muted" aria-hidden />
      </div>
    </div>
  );
});
