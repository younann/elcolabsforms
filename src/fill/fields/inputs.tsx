import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { cx } from '../../ui';
import type { Field } from '../../../shared/forms/types';

export type FieldProps<F extends Field = Field> = {
  field: F;
  value: unknown;
  onChange(id: string, value: unknown): void;
  disabled?: boolean;
};

export const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
export const obj = <T,>(v: unknown): T => (v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : ({} as T));
export const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const controlCls = cx(
  'block min-h-12 w-full rounded-ctl border border-border-strong bg-surface px-3.5 text-[17px] text-text',
  'placeholder:text-muted transition-[border-color,box-shadow] duration-150',
  'focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20',
  'disabled:bg-surface-2 disabled:text-muted',
);

export function Label({ htmlFor, children, required }: { htmlFor?: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-[15px] font-medium text-text">
      {children}
      {required && (
        <span className="ms-1 text-accent" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; required?: boolean };

export const TextArea = forwardRef<HTMLTextAreaElement, AreaProps>(function TextArea(
  { label, required, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={fid} required={required}>
          {label}
        </Label>
      )}
      <textarea
        ref={ref}
        id={fid}
        rows={3}
        className={cx(controlCls, 'min-h-24 resize-y py-2.5 leading-relaxed [field-sizing:content]')}
        {...rest}
      />
    </div>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { options: string[]; placeholder?: string };

export function Select({ options, placeholder = 'בחר', className, value, ...rest }: SelectProps) {
  return (
    <div className={cx('relative', className)}>
      <select className={cx(controlCls, 'appearance-none pe-10')} value={value ?? ''} {...rest}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <CaretDown className="pointer-events-none absolute inset-y-0 end-3.5 my-auto size-4 text-muted" aria-hidden />
    </div>
  );
}
