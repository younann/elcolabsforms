import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-fill text-accent-fg hover:opacity-90',
  accent: 'bg-accent-fill text-accent-fg hover:opacity-90',
  secondary: 'bg-surface-2 text-text hover:bg-border',
  ghost: 'bg-transparent text-accent hover:bg-accent-soft',
  danger: 'bg-danger-fill text-white hover:opacity-90',
};

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-[16px] gap-2',
  lg: 'min-h-[3.25rem] px-5 text-[17px] gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'press inline-flex shrink-0 items-center justify-center rounded-ctl font-semibold whitespace-nowrap',
        'transition-[transform,background-color,opacity] duration-150 ease-snap active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <CircleNotch className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
