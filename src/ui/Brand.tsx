import { FireExtinguisher } from '@phosphor-icons/react';
import { cx } from './cx';

export const APP_NAME = 'אלקו מעבדות';

export type BrandProps = { size?: 'md' | 'lg'; compact?: boolean; className?: string };

export function Brand({ size = 'md', compact, className }: BrandProps) {
  const lg = size === 'lg';
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <span
        className={cx('grid place-items-center rounded-ctl bg-accent text-accent-fg', lg ? 'size-11' : 'size-8')}
        aria-hidden
      >
        <FireExtinguisher className={lg ? 'size-6' : 'size-[18px]'} weight="fill" />
      </span>
      <span className={cx('font-semibold tracking-tight', lg ? 'text-xl' : 'text-[17px]', compact && 'max-sm:sr-only')}>{APP_NAME}</span>
    </span>
  );
}
