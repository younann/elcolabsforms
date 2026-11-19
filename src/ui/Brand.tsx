import { useId } from 'react';
import { cx } from './cx';

export const APP_NAME = 'ELCO';
export const TAGLINE = 'מעבדה לבדיקות גילוי וכיבוי אש';

/** Flat ELCO shield: gold shield, red "e". */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecc95a" />
          <stop offset="1" stopColor="#b0861a" />
        </linearGradient>
      </defs>
      <path d="M32 3 57 11v19c0 15.5-10.3 25.7-25 31C17.3 55.7 7 45.5 7 30V11Z" fill={`url(#${id}g)`} />
      <path d="M32 9.5 51 15.6V30c0 11.8-7.6 20-19 24.6C20.6 50 13 41.8 13 30V15.6Z" fill="#7a5a0c" opacity=".35" />
      <path d="M21.5 32.5h21A10.5 10.5 0 1 0 39.8 40" fill="none" stroke="#d4132f" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type BrandProps = { size?: 'md' | 'lg'; compact?: boolean; className?: string };

export function Brand({ size = 'md', compact, className }: BrandProps) {
  const lg = size === 'lg';
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <LogoMark className={lg ? 'size-12' : 'size-8'} />
      <span className={cx('font-bold tracking-[0.08em] text-gold', lg ? 'text-[26px]' : 'text-[19px]', compact && 'max-sm:sr-only')} dir="ltr">
        {APP_NAME}
      </span>
    </span>
  );
}

export function DevCredit({ className }: { className?: string }) {
  return (
    <p className={cx('text-center text-xs text-muted', className)} dir="ltr">
      Developed by{' '}
      <a href="https://devultra.net" target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline">
        devultra.net
      </a>
    </p>
  );
}
