import { useEffect, useRef, useSyncExternalStore } from 'react';
import { CheckCircle, Info, WarningOctagon } from '@phosphor-icons/react';
import { cx } from './cx';

export type ToastTone = 'info' | 'success' | 'error';
export type ToastOptions = { tone?: ToastTone; duration?: number };
export type ToastItem = { id: number; message: string; tone: ToastTone; duration: number; leaving: boolean };

const MAX = 3;
const EXIT_MS = 180;
let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit(next: ToastItem[]) {
  items = next;
  listeners.forEach((l) => l());
}

export function dismissToast(id: number) {
  if (!items.some((t) => t.id === id && !t.leaving)) return;
  emit(items.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
  setTimeout(() => emit(items.filter((t) => t.id !== id)), EXIT_MS);
}

/** Shows a short message; call from anywhere. */
export function toast(message: string, opts: ToastOptions = {}): number {
  const tone = opts.tone ?? 'info';
  const id = ++seq;
  const duration = opts.duration ?? (tone === 'error' ? 6000 : 3500);
  const next = [...items, { id, message, tone, duration, leaving: false }];
  emit(next);
  const live = next.filter((t) => !t.leaving);
  if (live.length > MAX) dismissToast(live[0].id);
  return id;
}
toast.success = (message: string, opts?: Omit<ToastOptions, 'tone'>) => toast(message, { ...opts, tone: 'success' });
toast.error = (message: string, opts?: Omit<ToastOptions, 'tone'>) => toast(message, { ...opts, tone: 'error' });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => items;

const icons = { info: Info, success: CheckCircle, error: WarningOctagon };
const iconCls = { info: 'text-info', success: 'text-success', error: 'text-danger' };

function Toast({ item }: { item: ToastItem }) {
  const remaining = useRef(item.duration);

  // timer pauses while the tab is hidden
  useEffect(() => {
    if (item.leaving) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = 0;
    const start = () => {
      started = Date.now();
      timer = setTimeout(() => dismissToast(item.id), remaining.current);
    };
    const pause = () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
    const onVis = () => (document.hidden ? pause() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [item.id, item.leaving]);

  const Icon = icons[item.tone];
  return (
    <li
      className="toast pointer-events-auto"
      data-leaving={item.leaving || undefined}
      role={item.tone === 'error' ? 'alert' : undefined}
    >
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        className="flex min-h-12 w-full items-center gap-3 rounded-box border border-border bg-surface px-4 py-3 text-start text-[15px] font-medium text-text shadow-[var(--shadow-pop)]"
      >
        <Icon className={cx('size-5 shrink-0', iconCls[item.tone])} weight="fill" aria-hidden />
        <span className="min-w-0 flex-1">{item.message}</span>
      </button>
    </li>
  );
}

/** Mount once near the root. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (
    <ol
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4 pt-[calc(var(--safe-top)+4rem)] lg:top-auto lg:bottom-0 lg:pt-0 lg:pb-[max(1rem,var(--safe-bottom))]"
    >
      {list.map((t) => (
        <Toast key={t.id} item={t} />
      ))}
    </ol>
  );
}
