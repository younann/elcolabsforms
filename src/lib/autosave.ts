export type FlushOptions = { expired?: boolean };
type Flush = (opts?: FlushOptions) => Promise<void>;

const flushers = new Set<Flush>();

/** Registers a flush hook; returns an unregister function. */
export function registerFlush(fn: Flush): () => void {
  flushers.add(fn);
  return () => {
    flushers.delete(fn);
  };
}

/** Runs every hook; never rejects. `expired`: session is gone, skip server work. */
export async function flushAll(opts: FlushOptions = {}): Promise<void> {
  await Promise.allSettled([...flushers].map((fn) => fn(opts)));
}

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';

/** `base`: server updatedAt the edits started from. */
export type LocalCopy<T> = { data: T; at: number; base?: string };

export function readLocal<T = Record<string, unknown>>(key: string): LocalCopy<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as LocalCopy<T>;
    return v && typeof v === 'object' && 'data' in v ? v : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, data: unknown, base?: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, at: Date.now(), base }));
  } catch {
    // storage full or blocked
  }
}

export function clearLocal(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage blocked
  }
}

/** Local copy wins when based on the current server version or written after it. */
export function preferLocal<T>(key: string, server: T, serverUpdatedAt: string): { data: T; fromLocal: boolean } {
  const local = readLocal<T>(key);
  const serverAt = Date.parse(serverUpdatedAt);
  const sameBase = !!local?.base && Date.parse(local.base) === serverAt;
  if (local && (sameBase || Number.isNaN(serverAt) || local.at > serverAt)) return { data: local.data, fromLocal: true };
  if (local) clearLocal(key);
  return { data: server, fromLocal: false };
}

export type AutosaveOptions<T> = {
  save: (data: T) => Promise<{ updatedAt: string }>;
  storageKey: string;
  delay?: number;
  /** Server updatedAt of the loaded data. */
  base?: string;
};

export type Autosave<T> = {
  update(data: T): void;
  flush(): Promise<void>;
  subscribe(fn: (s: SaveStatus) => void): () => void;
  status(): SaveStatus;
  dispose(): void;
};

const BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];

const statusOf = (e: unknown): number | undefined =>
  e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number' ? (e as { status: number }).status : undefined;

// network down or server hiccup: worth retrying
function retryable(e: unknown) {
  const s = statusOf(e);
  return s === undefined || s === 0 || s === 408 || s === 429 || s >= 500;
}

export function createAutosave<T>({ save, storageKey, delay = 1500, base }: AutosaveOptions<T>): Autosave<T> {
  let latest: { data: T } | null = null;
  let version = 0;
  let savedVersion = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let inFlight: Promise<void> | null = null;
  let current: SaveStatus = 'saved';
  let stopped = false;
  const listeners = new Set<(s: SaveStatus) => void>();

  const set = (s: SaveStatus) => {
    if (s === current) return;
    current = s;
    listeners.forEach((l) => l(s));
  };

  const schedule = (ms: number) => {
    clearTimeout(timer);
    if (stopped) return;
    timer = setTimeout(() => void run(), ms);
  };

  function run(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    if (inFlight) return inFlight;
    if (!latest || savedVersion === version) return Promise.resolve();
    const v = version;
    const data = latest.data;
    set('saving');
    inFlight = (async () => {
      try {
        const r = await save(data);
        if (r?.updatedAt) base = r.updatedAt;
        attempt = 0;
        savedVersion = Math.max(savedVersion, v);
        if (version === v) {
          clearLocal(storageKey);
          set('saved');
        } else if (latest) {
          // newer edits now sit on the new server version
          writeLocal(storageKey, latest.data, base);
        }
      } catch (e) {
        const offline = statusOf(e) === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false);
        set(offline ? 'offline' : 'error');
        if (retryable(e)) schedule(BACKOFF[Math.min(attempt++, BACKOFF.length - 1)]);
        return;
      } finally {
        inFlight = null;
      }
      // edits made during the save
      if (version !== savedVersion) schedule(delay);
    })();
    return inFlight;
  }

  const onOnline = () => {
    if (version !== savedVersion) {
      attempt = 0;
      schedule(0);
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline);

  async function flush(opts: FlushOptions = {}) {
    try {
      // session gone: local copy already holds everything
      if (opts.expired) {
        clearTimeout(timer);
        return;
      }
      if (inFlight) await inFlight;
      if (version !== savedVersion) await run();
    } catch {
      // never throws
    }
  }

  const unregister = registerFlush(flush);

  return {
    update(data: T) {
      latest = { data };
      version++;
      writeLocal(storageKey, data, base);
      attempt = 0;
      if (!inFlight) schedule(delay);
    },
    flush: () => flush(),
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    status: () => current,
    dispose() {
      stopped = true;
      clearTimeout(timer);
      unregister();
      listeners.clear();
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
    },
  };
}
