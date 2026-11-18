import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

export type Load<T> = { data: T | null; error: string | null; loading: boolean; reload(): Promise<void> };

const STORE = 'load-cache';
const MAX_CHARS = 200_000;
let cache: Map<string, unknown> | null = null;

function mem() {
  if (!cache) {
    cache = new Map();
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) cache = new Map(Object.entries(JSON.parse(raw) as Record<string, unknown>));
    } catch {
      // bad or blocked storage
    }
  }
  return cache;
}

function remember(key: string, value: unknown) {
  const m = mem();
  m.set(key, value);
  try {
    const json = JSON.stringify(Object.fromEntries(m));
    if (json.length <= MAX_CHARS) localStorage.setItem(STORE, json);
  } catch {
    // memory copy still works
  }
}

/** Drops every cached result; call when the user changes. */
export function clearLoadCache() {
  cache = new Map();
  try {
    localStorage.removeItem(STORE);
  } catch {
    // nothing stored
  }
}

/** Shows the last result for the key at once, then refreshes. */
export function useLoad<T>(fn: () => Promise<T>, key: string): Load<T> {
  const [data, setData] = useState<T | null>(() => (mem().get(key) as T | undefined) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const keyRef = useRef(key);
  keyRef.current = key;
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const r = await fnRef.current();
      if (n !== seq.current) return;
      remember(keyRef.current, r);
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

  const first = useRef(true);
  useEffect(() => {
    // initial state already read the cache
    if (!first.current) setData((mem().get(key) as T | undefined) ?? null);
    first.current = false;
    void reload();
  }, [key, reload]);

  return { data, error, loading, reload };
}
