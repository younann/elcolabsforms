import type { Config } from '@netlify/functions';
import { z } from 'zod';
import { handle, json, HttpError } from '../../server/http';
import { requireUser } from '../../server/auth';
import { formatAddress } from '../../shared/geocode';

// empty strings would coerce to 0
const coord = (max: number) => z.string().trim().min(1).transform(Number).pipe(z.number().min(-max).max(max));
const Query = z.object({ lat: coord(90), lon: coord(180) });

const UA = 'elco-labs-forms/1.0 (+https://elco-labs-forms.netlify.app)';

export default handle(async (req) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
  await requireUser(req);
  const q = new URL(req.url).searchParams;
  const p = Query.safeParse({ lat: q.get('lat') ?? undefined, lon: q.get('lon') ?? undefined });
  if (!p.success) throw new HttpError(400, 'מיקום לא תקין');

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({
    format: 'jsonv2',
    lat: String(p.data.lat),
    lon: String(p.data.lon),
    'accept-language': 'he',
    addressdetails: '1',
    zoom: '18',
  }).toString();

  let raw: unknown;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`nominatim ${r.status}`);
    raw = await r.json();
  } catch (e) {
    console.error('reverse geocode failed', e);
    throw new HttpError(502, 'שירות הכתובות אינו זמין כרגע, נסה שוב');
  }
  const found = formatAddress(raw);
  if (!found) throw new HttpError(404, 'לא נמצאה כתובת למיקום הזה');
  return json(found);
});

export const config: Config = { path: '/api/geocode/reverse' };
