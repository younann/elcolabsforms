import bcrypt from 'bcryptjs';

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

// same bcrypt cost when the user is missing
let dummy: Promise<string> | null = null;
export async function verifyOrDummy(p: string, hash: string | null | undefined): Promise<boolean> {
  if (hash) return verifyPassword(p, hash);
  dummy ??= hashPassword('dummy-password-never-matches');
  await verifyPassword(p, await dummy);
  return false;
}

export const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;
export const MAX_USER_FAILURES = MAX_FAILURES;
export const MAX_IP_FAILURES = 20;

export function isRateLimited(failedTimes: Date[], now: Date): boolean {
  return failedTimes.filter((t) => now.getTime() - t.getTime() <= LOGIN_WINDOW_MS).length >= MAX_FAILURES;
}

// counts include the current attempt
export function loginBlocked(userFails: number, ipFails: number): boolean {
  return userFails > MAX_USER_FAILURES || ipFails > MAX_IP_FAILURES;
}

// netlify client ip, then proxy header
export function clientIp(req: Request, ctxIp?: string | null): string | null {
  const h = req.headers;
  const ip = ctxIp || h.get('x-nf-client-connection-ip') || h.get('x-forwarded-for')?.split(',')[0];
  return ip?.trim() || null;
}
