import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';
import { cx } from './cx';

export type SheetProps = {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  children: ReactNode;
  /** Sticky actions row. */
  footer?: ReactNode;
  className?: string;
};

const DESKTOP = '(min-width: 768px)';

/** Bottom sheet under 768px, centered dialog above. */
export function Sheet({ open, onClose, title, children, footer, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d || typeof d.showModal !== 'function') return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // lock page scroll while open
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia(DESKTOP).matches || e.button !== 0 || drag.current) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    ref.current?.setAttribute('data-dragging', '');
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const s = drag.current;
    const d = ref.current;
    if (!s || !d) return;
    const raw = e.clientY - s.y;
    // resist upward pull
    s.dy = raw < 0 ? -Math.sqrt(-raw) * 2 : raw;
    d.style.transform = `translateY(${s.dy}px)`;
  }

  function onUp() {
    const s = drag.current;
    const d = ref.current;
    drag.current = null;
    if (!s || !d) return;
    d.removeAttribute('data-dragging');
    d.style.transform = '';
    const velocity = s.dy / (performance.now() - s.t);
    if (s.dy > d.offsetHeight * 0.3 || (s.dy > 8 && velocity > 0.11)) onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cx('sheet', className)}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[inherit] flex-col">
        <div
          className="shrink-0 touch-none select-none md:touch-auto"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border-strong md:hidden" aria-hidden />
          <div className="flex items-center gap-3 ps-5 pe-2 pt-2 pb-1 md:pt-3">
            <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="press grid size-11 place-items-center rounded-full text-muted transition-[transform,background-color] duration-150 ease-snap hover:bg-surface-2 active:scale-[0.94]"
            >
              <X className="size-5" weight="bold" aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-5">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-border px-5 pt-3 pb-[max(0.75rem,var(--safe-bottom))] md:pb-3">
            {footer}
          </div>
        ) : (
          <div className="shrink-0 pb-[var(--safe-bottom)] md:pb-0" aria-hidden />
        )}
      </div>
    </dialog>
  );
}
