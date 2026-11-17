import { describe, test, expect } from 'vitest';
import { hashPassword, verifyPassword, isRateLimited, loginBlocked, verifyOrDummy, clientIp } from '../../server/auth-core';

describe('passwords', () => {
  test('hash verifies with the right password', async () => {
    const h = await hashPassword('secret123');
    expect(await verifyPassword('secret123', h)).toBe(true);
  });
  test('hash rejects the wrong password', async () => {
    const h = await hashPassword('secret123');
    expect(await verifyPassword('nope', h)).toBe(false);
  });
});

describe('isRateLimited', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  test('5 failures within 15 minutes is limited', () => {
    expect(isRateLimited([1, 2, 3, 4, 5].map(minsAgo), now)).toBe(true);
  });
  test('4 failures is not limited', () => {
    expect(isRateLimited([1, 2, 3, 4].map(minsAgo), now)).toBe(false);
  });
  test('5 failures spread over 20 minutes is not limited', () => {
    expect(isRateLimited([1, 5, 10, 16, 20].map(minsAgo), now)).toBe(false);
  });
});

describe('login hardening', () => {
  test('blocks the 6th attempt per user and the 21st per ip', () => {
    expect(loginBlocked(5, 1)).toBe(false);
    expect(loginBlocked(6, 1)).toBe(true);
    expect(loginBlocked(1, 20)).toBe(false);
    expect(loginBlocked(1, 21)).toBe(true);
  });
  test('missing user still runs bcrypt and fails', async () => {
    expect(await verifyOrDummy('x', null)).toBe(false);
    const h = await hashPassword('secret12345');
    expect(await verifyOrDummy('secret12345', h)).toBe(true);
  });
  test('client ip prefers context, then netlify header, then forwarded-for', () => {
    const req = (h: Record<string, string>) => new Request('http://x/', { headers: h });
    expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }), '9.9.9.9')).toBe('9.9.9.9');
    expect(clientIp(req({ 'x-nf-client-connection-ip': '3.3.3.3', 'x-forwarded-for': '1.1.1.1' }))).toBe('3.3.3.3');
    expect(clientIp(req({ 'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2' }))).toBe('1.1.1.1');
    expect(clientIp(req({}))).toBeNull();
  });
});
