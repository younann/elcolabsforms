import { Check, Checks } from '@phosphor-icons/react';
import { cx } from '../ui';
import type { Section } from '../../shared/forms/types';
import { naLabel } from './progress';

export type SectionItem = { section: Section; done: number; total: number };

export type SectionNavProps = {
  items: SectionItem[];
  current?: string;
  onJump(sectionId: string): void;
  onMarkNA?: (sectionId: string) => void;
  className?: string;
};

/** Section list with answered/total; used in the side column and the sheet. */
export function SectionNav({ items, current, onJump, onMarkNA, className }: SectionNavProps) {
  return (
    <nav aria-label="סעיפי הטופס" className={className}>
      <ol className="flex flex-col gap-0.5">
        {items.map(({ section: s, done, total }) => {
          const complete = total > 0 && done === total;
          const na = onMarkNA && !complete ? naLabel(s) : null;
          const active = current === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onJump(s.id)}
                aria-current={active ? 'location' : undefined}
                className={cx(
                  'press flex min-h-11 w-full items-center gap-3 rounded-ctl px-3 py-2 text-start transition-[transform,background-color] duration-150 ease-snap active:scale-[0.98]',
                  active ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                )}
              >
                <span
                  className={cx(
                    'grid size-6 shrink-0 place-items-center rounded-full border transition-colors duration-200',
                    complete ? 'border-success bg-success text-surface' : total > 0 ? 'border-border-strong' : 'border-dashed border-border',
                  )}
                  aria-hidden
                >
                  {complete && <Check className="size-3.5" weight="bold" />}
                </span>
                <span className={cx('min-w-0 flex-1 text-[15px] leading-snug', active ? 'font-semibold' : 'font-medium')}>{s.title}</span>
                {total > 0 && (
                  <span
                    className={cx('shrink-0 text-[13px] tabular-nums', complete ? 'text-success' : 'text-muted')}
                    aria-label={`${done} מתוך ${total}`}
                    dir="ltr"
                  >
                    {done}/{total}
                  </span>
                )}
              </button>
              {na && (
                <button
                  type="button"
                  onClick={() => onMarkNA!(s.id)}
                  className="press ms-9 mb-1 inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-[14px] font-medium text-accent transition-[transform,background-color] duration-150 ease-snap hover:bg-accent-soft active:scale-[0.97]"
                >
                  <Checks className="size-4" aria-hidden />
                  {na}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
