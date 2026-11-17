import { describe, test, expect } from 'vitest';
import { hashPassword, verifyPassword, isRateLimited } from '../../server/auth-core';

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
