import { flushAll } from './autosave';

export type ApiErrorBody = { error?: string; [key: string]: unknown };

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(typeof body.error === 'string' ? body.error : `שגיאה (${status})`);
    this.name = 'ApiError';
  }
}

export type ApiInit = RequestInit & { json?: unknown };

const NETWORK_ERROR = 'אין חיבור לשרת. בדוק את החיבור לרשת ונסה שוב';

// auth endpoints handle 401 themselves
const NO_REDIRECT = ['/api/auth/login', '/api/auth/me', '/api/auth/logout'];

let onUnauthorized: () => void = () => {
  if (typeof location !== 'undefined' && location.pathname !== '/login') location.assign('/login');
};
let handling = false;

/** Lets the router replace the default full-page redirect. */
export function setUnauthorizedHandler(fn: () => void): () => void {
  const prev = onUnauthorized;
  onUnauthorized = fn;
  return () => {
    onUnauthorized = prev;
  };
}

async function handleUnauthorized() {
  if (handling) return;
  handling = true;
  try {
    await flushAll();
  } finally {
    handling = false;
  }
  onUnauthorized();
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers: h, ...rest } = init;
  const headers = new Headers(h);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  let body = rest.body;
  if (json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(path, { ...rest, body, headers, credentials: 'include' });
  } catch {
    throw new ApiError(0, { error: NETWORK_ERROR });
  }

  const data = await readBody(res);
  if (!res.ok) {
    const err = new ApiError(res.status, isObject(data) ? (data as ApiErrorBody) : {});
    if (res.status === 401 && !NO_REDIRECT.some((p) => path.startsWith(p))) await handleUnauthorized();
    throw err;
  }
  return data as T;
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return undefined;
    }
  }
  return await res.text();
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
