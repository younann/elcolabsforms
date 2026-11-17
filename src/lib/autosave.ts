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

/** `locked`: server refuses edits, e.g. already submitted. */
export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error' | 'conflict' | 'locked';

/** `base`: server updatedAt the edits started from; `sent`: hashes of payloads sent since. */
export type LocalCopy<T> = { data: T; at: number; base?: string; sent?: string[] };

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

function writeLocal(key: string, data: unknown, base?: string, sent?: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, at: Date.now(), base, sent: sent?.length ? sent : undefined }));
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

// stable JSON: sorted keys, undefined dropped
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => [k, canon(o[k])]),
    );
  }
  return v;
}

const canonJson = (v: unknown) => JSON.stringify(canon(v ?? null));

/** Deep equality as the server stores it (key order ignored). */
export function sameData(a: unknown, b: unknown): boolean {
  return canonJson(a) === canonJson(b);
}

/** Short content hash (FNV-1a) of the canonical JSON. */
export function dataHash(v: unknown): string {
  const s = canonJson(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}:${s.length}`;
}

const sameTime = (a?: string, b?: string) => !!a && !!b && Date.parse(a) === Date.parse(b);

export type Picked<T> = { data: T; fromLocal: boolean; conflict?: T };

/**
 * Decides between the device copy and the server copy.
 * A server version written by this device's own saves is not a conflict.
 */
export function preferLocal<T>(key: string, server: T, serverUpdatedAt: string): Picked<T> {
  const local = readLocal<T>(key);
  if (!local) return { data: server, fromLocal: false };
  if (sameTime(local.base, serverUpdatedAt)) return { data: local.data, fromLocal: true };
  if (sameData(local.data, server)) {
    clearLocal(key);
    return { data: server, fromLocal: false };
  }
  // our own save landed but its reply never came back
  if (local.sent?.includes(dataHash(server))) {
    writeLocal(key, local.data, serverUpdatedAt);
    return { data: local.data, fromLocal: true };
  }
  // older copies carry no base
  if (!local.base) {
    const serverAt = Date.parse(serverUpdatedAt);
    if (Number.isNaN(serverAt) || local.at > serverAt) return { data: local.data, fromLocal: true };
    clearLocal(key);
    return { data: server, fromLocal: false };
  }
  return { data: server, fromLocal: false, conflict: local.data };
}

export type ServerCopy<T> = { data: T; updatedAt: string };

export type AutosaveOptions<T> = {
  /** Saves `data` over server version `base`; rejects with status 409 when stale. */
  save: (data: T, base?: string) => Promise<{ updatedAt: string }>;
  storageKey: string;
  delay?: number;
  /** Server updatedAt of the loaded data. */
  base?: string;
  /** Reads the server copy after a 409. */
  fetchServer?: () => Promise<ServerCopy<T>>;
  /** Server holds someone else's changes. */
  onConflict?: (server: ServerCopy<T>) => void;
};

export type Autosave<T> = {
  update(data: T): void;
  flush(): Promise<void>;
  subscribe(fn: (s: SaveStatus) => void): () => void;
  status(): SaveStatus;
  /** Conflict: save local data over the given server version. */
  keepMine(serverUpdatedAt: string, data?: T): void;
  /** Conflict: drop local edits, server version becomes the base. */
  takeServer(serverUpdatedAt: string): void;
  dispose(): void;
};

const BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];
const MAX_SENT = 20;

const statusOf = (e: unknown): number | undefined =>
  e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number' ? (e as { status: number }).status : undefined;

// network down or server hiccup: worth retrying
function retryable(e: unknown) {
  const s = statusOf(e);
  return s === undefined || s === 0 || s === 408 || s === 429 || s >= 500;
}

// shared by every instance on one key, so remounts never race
type KeyState = { base?: string; sent: string[]; lock: Promise<void> | null; refs: number };
const keyStates = new Map<string, KeyState>();

function acquire(key: string, base?: string): KeyState {
  let k = keyStates.get(key);
  if (!k) {
    k = { base, sent: readLocal(key)?.sent ?? [], lock: null, refs: 0 };
    keyStates.set(key, k);
  } else if (base && (!k.base || Date.parse(base) > Date.parse(k.base))) {
    // server versions only move forward
    k.base = base;
  }
  k.refs++;
  return k;
}

function release(key: string, k: KeyState) {
  if (k.refs <= 0 && !k.lock && keyStates.get(key) === k) keyStates.delete(key);
}

export function createAutosave<T>({ save, storageKey, delay = 1500, base, fetchServer, onConflict }: AutosaveOptions<T>): Autosave<T> {
  const ks = acquire(storageKey, base);
  let latest: { data: T } | null = null;
  let version = 0;
  let savedVersion = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let inFlight: Promise<void> | null = null;
  let current: SaveStatus = 'saved';
  let stopped = false;
  let expired = false;
  const listeners = new Set<(s: SaveStatus) => void>();

  const set = (s: SaveStatus) => {
    if (s === current) return;
    current = s;
    listeners.forEach((l) => l(s));
  };

  const persist = () => {
    if (latest) writeLocal(storageKey, latest.data, ks.base, ks.sent);
  };

  const schedule = (ms: number) => {
    clearTimeout(timer);
    if (stopped) return;
    timer = setTimeout(() => void run(), ms);
  };

  const blocked = () => expired || current === 'conflict' || current === 'locked';

  function run(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    if (inFlight) return inFlight;
    if (blocked() || !latest || savedVersion === version) return Promise.resolve();
    set('saving');
    inFlight = (async () => {
      // one save per key at a time
      while (ks.lock) await ks.lock;
      if (blocked() || !latest || savedVersion === version) {
        inFlight = null;
        if (!blocked() && savedVersion === version) set('saved');
        return;
      }
      const v = version;
      const data = latest.data;
      ks.sent = [...ks.sent.filter((h) => h !== dataHash(data)), dataHash(data)].slice(-MAX_SENT);
      persist();
      let done!: () => void;
      ks.lock = new Promise<void>((r) => (done = r));
      let again = false;
      try {
        const r = await save(data, ks.base);
        ks.base = r.updatedAt;
        ks.sent = [];
        attempt = 0;
        savedVersion = Math.max(savedVersion, v);
        if (version === v) {
          clearLocal(storageKey);
          set('saved');
        } else {
          // newer edits now sit on the new server version
          persist();
          again = true;
        }
      } catch (e) {
        if (statusOf(e) === 409 && fetchServer) {
          try {
            const srv = await fetchServer();
            if (ks.sent.includes(dataHash(srv.data))) {
              // server holds one of our own saves: move on from it
              ks.base = srv.updatedAt;
              ks.sent = [];
              persist();
              attempt = 0;
              again = true;
            } else {
              persist();
              set('conflict');
              onConflict?.(srv);
            }
          } catch (fe) {
            set(statusOf(fe) === 0 ? 'offline' : 'error');
            schedule(BACKOFF[Math.min(attempt++, BACKOFF.length - 1)]);
          }
        } else if (statusOf(e) === 403) {
          // form left the editable state
          persist();
          set('locked');
        } else {
          const offline = statusOf(e) === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false);
          set(offline ? 'offline' : 'error');
          if (retryable(e)) schedule(BACKOFF[Math.min(attempt++, BACKOFF.length - 1)]);
        }
      } finally {
        ks.lock = null;
        done();
        inFlight = null;
        if (stopped) release(storageKey, ks);
      }
      if (again && !stopped) await run();
      else if (again) schedule(0);
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
        expired = true;
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
      persist();
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
    keepMine(serverUpdatedAt: string, data?: T) {
      ks.base = serverUpdatedAt;
      ks.sent = [];
      if (data !== undefined) latest = { data };
      if (!latest) return;
      version++;
      persist();
      attempt = 0;
      set('saving');
      void run();
    },
    takeServer(serverUpdatedAt: string) {
      ks.base = serverUpdatedAt;
      ks.sent = [];
      clearTimeout(timer);
      latest = null;
      savedVersion = version;
      clearLocal(storageKey);
      set('saved');
    },
    dispose() {
      if (stopped) return;
      stopped = true;
      ks.refs--;
      clearTimeout(timer);
      unregister();
      listeners.clear();
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
      release(storageKey, ks);
    },
  };
}
