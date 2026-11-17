export type AddressParts = { road: string | null; houseNumber: string | null; city: string | null };
export type GeoAddress = { address: string; parts: AddressParts };

// street names that already carry a type word
const STREET_TYPE = /^(רחוב|רח['׳]|שדרות|שד['׳]|דרך|כביש|כיכר|ככר|סמטת|סמטה|סמ['׳]|מעלה|מעלות|משעול|שביל|נתיב|טיילת|רמת|גבעת)\s/;

const pick = (a: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = a[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

/** Short Hebrew address from a Nominatim reverse result. */
export function formatAddress(raw: unknown): GeoAddress | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = (raw as { address?: unknown }).address;
  if (!a || typeof a !== 'object') return null;
  const addr = a as Record<string, unknown>;

  const road = pick(addr, ['road', 'pedestrian', 'footway', 'residential']);
  const city = pick(addr, ['city', 'town', 'village', 'hamlet', 'suburb', 'municipality']);
  const houseNumber = road ? pick(addr, ['house_number']) : null;
  // no road: name the area instead
  const area = road ? null : pick(addr, ['neighbourhood', 'quarter', 'suburb']);

  const first = road
    ? `${STREET_TYPE.test(road) ? road : `רח׳ ${road}`}${houseNumber ? ` ${houseNumber}` : ''}`
    : area && area !== city
      ? area
      : null;
  const address = [first, city].filter(Boolean).join(', ');
  if (!address) return null;
  return { address, parts: { road, houseNumber, city } };
}
