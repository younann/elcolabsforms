import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Element at the inline end of the input, e.g. a toggle. */
  end?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, end, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[15px] font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(hintId, errorId) || undefined}
          className={cx(
            'block min-h-12 w-full rounded-ctl border border-border-strong bg-surface px-3.5 text-[17px] text-text',
            'placeholder:text-muted transition-[border-color,box-shadow] duration-150',
            'focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20',
            'aria-invalid:border-danger aria-invalid:focus:ring-danger/20',
            'disabled:bg-surface-2 disabled:text-muted',
            end ? 'pe-12' : undefined,
          )}
          {...rest}
        />
        {end && <div className="absolute inset-y-0 end-0 flex items-center pe-0.5">{end}</div>}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
