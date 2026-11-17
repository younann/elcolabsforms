import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public body?: Record<string, unknown>) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function handle(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.body }, e.status);
      console.error(e);
      return json({ error: 'שגיאת שרת' }, 500);
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'בקשה לא תקינה');
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(400, 'נתונים לא תקינים', { issues: r.error.issues });
  return r.data;
}

export function methodNotAllowed(): never {
  throw new HttpError(405, 'Method not allowed');
}
