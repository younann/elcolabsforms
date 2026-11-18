import { NavigationArrow } from '@phosphor-icons/react';
import { wazeLink } from '../lib/waze';
import { cx } from '../ui';

/** Opens Waze navigation to the site. */
export function WazeButton({ address, compact }: { address: string; compact?: boolean }) {
  return (
    <a
      href={wazeLink(address)}
      target="_blank"
      rel="noopener"
      data-testid="waze"
      className={cx(
        'press inline-flex w-full items-center justify-center gap-2 rounded-ctl bg-[#33ccff] px-4 font-semibold text-[#0b2a3a] transition-[transform,opacity] duration-150 active:scale-[0.98]',
        compact ? 'min-h-11 text-[16px]' : 'min-h-12 text-[17px]',
      )}
    >
      <NavigationArrow className="size-5 -scale-x-100" weight="fill" aria-hidden />
      ניווט עם Waze
    </a>
  );
}
