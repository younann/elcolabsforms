import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ label, hint, id, className, ...rest }, ref) {
  const auto = useId();
  const taId = id ?? auto;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={taId} className="text-[15px] font-medium text-text">
        {label}
      </label>
      <textarea
        ref={ref}
        id={taId}
        aria-describedby={hint ? `${taId}-hint` : undefined}
        className={cx(
          'block min-h-28 w-full resize-y rounded-ctl border border-border-strong bg-surface px-3.5 py-3 text-[17px] leading-relaxed text-text',
          'placeholder:text-muted transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20',
        )}
        {...rest}
      />
      {hint && (
        <p id={`${taId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
});
