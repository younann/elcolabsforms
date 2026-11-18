import { describe, expect, it } from 'vitest';
import { ClientInput, ClientPatch, SiteInput } from '../../shared/clients';

describe('client and site input', () => {
  it('rejects empty name and bad email', () => {
    expect(ClientInput.safeParse({ name: '  ' }).success).toBe(false);
    expect(ClientInput.safeParse({ name: 'א', email: 'nope' }).success).toBe(false);
  });
  it('blank contact fields become null, missing stay absent', () => {
    expect(ClientInput.parse({ name: ' חברה ', phone: '', email: '' })).toEqual({ name: 'חברה', phone: null, email: null });
    expect(ClientPatch.parse({ active: false })).toEqual({ active: false });
  });
  it('site requires address', () => {
    expect(SiteInput.safeParse({ name: 'מגדל' }).success).toBe(false);
    expect(SiteInput.safeParse({ name: 'מגדל', address: ' ' }).success).toBe(false);
    expect(SiteInput.parse({ name: 'מגדל', address: 'הרצל 1, חיפה' }).address).toBe('הרצל 1, חיפה');
  });
});
