import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

export type Load<T> = { data: T | null; error: string | null; loading: boolean; reload(): Promise<void> };

/** Loads once per key; keeps old data while reloading. */
export function useLoad<T>(fn: () => Promise<T>, key: string): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const r = await fnRef.current();
      if (n !== seq.current) return;
      setData(r);
      setError(null);
    } catch (e) {
      if (n !== seq.current) return;
      if (e instanceof ApiError && e.status === 401) return;
      setError(e instanceof Error ? e.message : 'הטעינה נכשלה');
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(null);
    void reload();
  }, [key, reload]);

  return { data, error, loading, reload };
}
