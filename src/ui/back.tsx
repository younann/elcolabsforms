import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';

// open overlays, newest last
const stack: { close(): void }[] = [];

/** While open, the back gesture closes this overlay instead of leaving the page. */
export function useBackCloses(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open) return;
    const entry = { close: () => ref.current() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}

/** Mount once inside the router. */
export function BackGuard() {
  const blocker = useBlocker(({ historyAction }) => historyAction === 'POP' && stack.length > 0);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    blocker.reset();
    stack.at(-1)?.close();
  }, [blocker]);
  return null;
}

/** Back within the app when there is history, else to the fallback. */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
