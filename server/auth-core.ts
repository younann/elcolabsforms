import bcrypt from 'bcryptjs';

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;

export function isRateLimited(failedTimes: Date[], now: Date): boolean {
  return failedTimes.filter((t) => now.getTime() - t.getTime() <= WINDOW_MS).length >= MAX_FAILURES;
}
