import { describe, expect, test } from 'vitest';
import { jobMessage, normalizeIlPhone, waLink } from '../../shared/whatsapp';

describe('normalizeIlPhone', () => {
  test('normalizes', () => {
    expect(normalizeIlPhone('050-123 4567')).toBe('972501234567');
    expect(normalizeIlPhone('+972 50 123 4567')).toBe('972501234567');
    expect(normalizeIlPhone('04-8123456')).toBe('97248123456');
    expect(normalizeIlPhone('123')).toBeNull();
    expect(normalizeIlPhone(null)).toBeNull();
  });
});

test('waLink encodes text', () => {
  expect(waLink('972501234567', 'שלום & היי')).toBe('https://wa.me/972501234567?text=%D7%A9%D7%9C%D7%95%D7%9D%20%26%20%D7%94%D7%99%D7%99');
});

describe('jobMessage', () => {
  const base = { inspectorName: 'דנה', clientName: 'מגדלי הים', contactPerson: 'יוסי', contactPhone: '0501112222', siteName: 'בניין A', siteAddress: 'הרצל 12', plannedDate: '2026-11-24', forms: ['גז 1', 'גז 2'], note: null, link: 'https://x/jobs/1' };
  test('includes all parts', () => {
    const m = jobMessage(base);
    for (const s of ['דנה', 'מגדלי הים', 'יוסי', '0501112222', 'בניין A', 'הרצל 12', 'גז 1', 'גז 2', 'https://x/jobs/1']) expect(m).toContain(s);
    expect(m).not.toContain('null');
    expect(m).not.toContain('undefined');
  });
  test('omits empty parts', () => {
    const m = jobMessage({ ...base, contactPerson: undefined, contactPhone: null });
    expect(m).not.toContain('undefined');
    expect(m).not.toContain('null');
  });
});
