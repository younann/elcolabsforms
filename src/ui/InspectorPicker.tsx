import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { MagnifyingGlass, UserCircle, X } from '@phosphor-icons/react';
import { rankInspectors, type Inspector } from '../../shared/inspector-rank';
import { cx } from './cx';
import { useBackCloses } from './back';

export type { Inspector };

export type InspectorPickerProps = {
  label: ReactNode;
  options: Inspector[];
  /** Selected inspector id, empty for none. */
  value: string;
  onChange(inspector: Inspector | null): void;
  placeholder?: string;
  /** List in the page flow instead of a popover, e.g. inside a sheet. */
  inline?: boolean;
  /** Shows a clear (×) button while a value is set. */
  clearable?: boolean;
  /** Id left out of the list, e.g. the current owner. */
  excludeId?: string;
  autoFocus?: boolean;
  loading?: boolean;
  className?: string;
  /** Words for what is picked, e.g. clients. */
  noun?: { one: string; many: string };
};

const MAX = 50;

/** Type-ahead combobox over inspectors. */
export function InspectorPicker({
  label,
  options,
  value,
  onChange,
  noun = { one: 'בודק', many: 'בודקים' },
  placeholder = `הקלד שם ${noun.one}`,
  inline = false,
  clearable = false,
  excludeId,
  autoFocus,
  loading,
  className,
}: InspectorPickerProps) {
  const id = useId();
  const listId = `${id}-list`;
  const input = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.id === value) ?? null;
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(inline);
  const [active, setActive] = useState(0);

  const matches = useMemo(
    () => rankInspectors(query, excludeId ? options.filter((o) => o.id !== excludeId) : options).slice(0, MAX),
    [query, options, excludeId],
  );
  const shown = inline || open;

  useBackCloses(!inline && open, () => {
    setOpen(false);
    input.current?.blur();
  });
  const activeId = shown && matches[active] ? `${id}-opt-${matches[active].id}` : undefined;

  function choose(o: Inspector) {
    onChange(o);
    setQuery('');
    setEditing(false);
    if (!inline) {
      setOpen(false);
      input.current?.blur();
    }
  }

  function move(delta: number) {
    if (!shown) setOpen(true);
    if (!matches.length) return;
    const next = (active + delta + matches.length) % matches.length;
    setActive(next);
    // keep the active option in view
    requestAnimationFrame(() => document.getElementById(`${id}-opt-${matches[next].id}`)?.scrollIntoView?.({ block: 'nearest' }));
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(shown ? 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(shown ? -1 : 0);
    } else if (e.key === 'Enter') {
      if (shown && matches[active]) {
        e.preventDefault();
        choose(matches[active]);
      }
    } else if (e.key === 'Escape') {
      if (!inline && open) {
        // stop a parent sheet closing too
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      } else if (query) {
        e.preventDefault();
        e.stopPropagation();
        setQuery('');
        setActive(0);
      }
    }
  }

  const text = editing ? query : (selected?.displayName ?? '');

  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[15px] font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-5 text-muted" aria-hidden />
          <input
            ref={input}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={shown}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            autoFocus={autoFocus}
            placeholder={placeholder}
            value={text}
            onFocus={() => {
              setEditing(true);
              setOpen(true);
              setActive(0);
            }}
            onBlur={() => {
              setEditing(false);
              setQuery('');
              if (!inline) setOpen(false);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setEditing(true);
              setOpen(true);
              setActive(0);
            }}
            onKeyDown={onKey}
            className={cx(
              'block min-h-12 w-full rounded-ctl border border-border-strong bg-surface ps-11 text-[17px] text-text',
              'placeholder:text-muted transition-[border-color,box-shadow] duration-150',
              'focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20',
              clearable && value ? 'pe-12' : 'pe-3.5',
            )}
          />
          {clearable && value && (
            <button
              type="button"
              aria-label={`ניקוי ה${noun.one}`}
              data-testid="picker-clear"
              // keep focus where it is
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(null);
                setQuery('');
              }}
              className="press absolute inset-y-0 end-0.5 my-auto grid size-11 touch-manipulation place-items-center rounded-full text-muted select-none transition-[transform,background-color] duration-150 ease-snap hover:bg-surface-2 active:scale-[0.94]"
            >
              <X className="size-[18px]" weight="bold" aria-hidden />
            </button>
          )}
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label={noun.many}
          hidden={!shown}
          className={cx(
            'overscroll-contain',
            inline
              ? 'mt-2 flex flex-col gap-0.5'
              : cx(
                  'absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-box border border-border bg-surface p-1 shadow-[var(--shadow-pop)]',
                  'origin-top transition-[opacity,transform] duration-150 ease-snap starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none',
                ),
          )}
        >
          {loading && !options.length ? (
            <li className="px-3 py-3 text-[15px] text-muted">טוען…</li>
          ) : matches.length === 0 ? (
            <li className="px-3 py-3 text-[15px] text-muted">לא נמצא {noun.one}</li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o.id}
                id={`${id}-opt-${o.id}`}
                role="option"
                aria-selected={o.id === value}
                data-active={i === active || undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(o)}
                className={cx(
                  'flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-ctl px-3 py-2 select-none',
                  'data-active:bg-surface-2 aria-selected:font-semibold',
                )}
              >
                <UserCircle className="size-6 shrink-0 text-muted" weight={o.id === value ? 'fill' : 'regular'} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[16px]">{o.displayName}</span>
                <bdi className="shrink-0 text-[13px] text-muted" dir="ltr">
                  {o.username}
                </bdi>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
