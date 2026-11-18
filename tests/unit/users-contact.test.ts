import { describe, expect, it } from 'vitest';
import { UserCreate, UserPatch } from '../../shared/users';

describe('user contact fields', () => {
  it('accepts email and phone', () => {
    expect(UserPatch.parse({ email: 'a@b.co', phone: '050-1234567' })).toEqual({ email: 'a@b.co', phone: '050-1234567' });
  });
  it('rejects a bad email', () => {
    expect(UserPatch.safeParse({ email: 'nope' }).success).toBe(false);
  });
  it('maps empty to null and leaves missing absent', () => {
    expect(UserPatch.parse({ email: '', phone: '  ' })).toEqual({ email: null, phone: null });
    expect(UserPatch.parse({})).toEqual({});
  });
  it('create keeps contact optional', () => {
    const b = UserCreate.parse({ username: 'Dan', displayName: 'דן', password: 'x'.repeat(20), role: 'inspector' });
    expect(b.username).toBe('dan');
    expect(b.email).toBeUndefined();
  });
});
