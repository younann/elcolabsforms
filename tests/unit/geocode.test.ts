import { describe, expect, it } from 'vitest';
import { formatAddress } from '../../shared/geocode';

const haifa = {
  place_id: 1,
  lat: '32.794',
  lon: '34.989',
  display_name: '45, הרצל, הדר הכרמל, חיפה, נפת חיפה, מחוז חיפה, 3303845, ישראל',
  address: {
    house_number: '45',
    road: 'הרצל',
    suburb: 'הדר הכרמל',
    city: 'חיפה',
    county: 'נפת חיפה',
    state: 'מחוז חיפה',
    postcode: '3303845',
    country: 'ישראל',
    country_code: 'il',
  },
};

describe('formatAddress', () => {
  it('formats a city street with house number', () => {
    expect(formatAddress(haifa)).toEqual({
      address: 'רח׳ הרצל 45, חיפה',
      parts: { road: 'הרצל', houseNumber: '45', city: 'חיפה' },
    });
  });

  it('falls back to town', () => {
    const r = formatAddress({ address: { road: 'הגפן', house_number: '3', town: 'זכרון יעקב', country: 'ישראל' } });
    expect(r?.address).toBe('רח׳ הגפן 3, זכרון יעקב');
    expect(r?.parts.city).toBe('זכרון יעקב');
  });

  it('falls back to village', () => {
    const r = formatAddress({ address: { road: 'הזית', village: 'עין הוד' } });
    expect(r?.address).toBe('רח׳ הזית, עין הוד');
  });

  it('uses suburb when no city', () => {
    const r = formatAddress({ address: { road: 'האלה', house_number: '7', suburb: 'קריית חיים' } });
    expect(r?.address).toBe('רח׳ האלה 7, קריית חיים');
  });

  it('omits a missing house number', () => {
    const r = formatAddress({ address: { road: 'הרצל', city: 'חיפה' } });
    expect(r).toEqual({ address: 'רח׳ הרצל, חיפה', parts: { road: 'הרצל', houseNumber: null, city: 'חיפה' } });
  });

  it('keeps an existing street type word', () => {
    expect(formatAddress({ address: { road: 'שדרות בן גוריון', house_number: '2', city: 'חיפה' } })?.address).toBe('שדרות בן גוריון 2, חיפה');
    expect(formatAddress({ address: { road: 'דרך העצמאות', city: 'חיפה' } })?.address).toBe('דרך העצמאות, חיפה');
    expect(formatAddress({ address: { road: 'רחוב יפו', city: 'חיפה' } })?.address).toBe('רחוב יפו, חיפה');
  });

  it('uses a place name when there is no road', () => {
    expect(formatAddress({ address: { neighbourhood: 'נווה שאנן', city: 'חיפה' } })?.address).toBe('נווה שאנן, חיפה');
    expect(formatAddress({ address: { city: 'חיפה' } })?.address).toBe('חיפה');
  });

  it('ignores a house number without a road', () => {
    expect(formatAddress({ address: { house_number: '9', village: 'דליית אל-כרמל' } })?.address).toBe('דליית אל-כרמל');
  });

  it('returns null when nothing usable', () => {
    expect(formatAddress({ error: 'Unable to geocode' })).toBeNull();
    expect(formatAddress({ address: { country: 'ישראל' } })).toBeNull();
    expect(formatAddress(null)).toBeNull();
    expect(formatAddress('x')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(formatAddress({ address: { road: '  הנביאים ', house_number: ' 12 ', city: ' חיפה ' } })?.address).toBe('רח׳ הנביאים 12, חיפה');
  });
});
