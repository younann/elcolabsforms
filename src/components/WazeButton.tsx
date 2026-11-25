import { NavigationArrow } from '@phosphor-icons/react';
import { wazeLink } from '../../shared/waze';
import { cx } from '../ui';

/** Opens Waze navigation to the site. */
export function WazeButton({ address, compact }: { address: string; compact?: boolean }) {
  return (
    <a
      href={wazeLink(address)}
      target="_blank"
      rel="noopener"
      aria-label="ניווט עם Waze"
      data-testid="waze"
      className={cx(
        'press w-full items-center justify-center rounded-ctl font-semibold text-info transition-[transform,opacity] duration-150 active:opacity-60',
        compact ? 'inline-flex min-h-11 gap-2 bg-info-soft text-[16px]' : 'flex min-h-[3.5rem] flex-col gap-0.5 bg-surface px-3 py-2 text-[13px] shadow-[var(--shadow-card)]',
      )}
    >
      <NavigationArrow className={compact ? "size-5 -scale-x-100" : "size-6 -scale-x-100"} weight="fill" aria-hidden />
      ניווט עם Waze
    </a>
  );
}
