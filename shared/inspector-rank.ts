export type Inspector = { id: string; displayName: string; username: string };

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Lowercase, base Hebrew letters, single spaces. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '') // niqqud
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/["'׳״.\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// lower is better; null means no match
function score(q: string, qs: string, p: Inspector): number | null {
  const names = [normalizeName(p.displayName), normalizeName(p.username)];
  const flat = names.map((n) => n.replace(/ /g, ''));
  if (names.some((n, i) => n === q || flat[i] === qs)) return 0;
  if (names.some((n, i) => n.startsWith(q) || flat[i].startsWith(qs))) return 1;
  if (names.some((n) => n.split(' ').some((w) => w.startsWith(q)))) return 2;
  if (flat.some((n) => n.includes(qs))) return 3;
  // fuzzy only from 3 letters
  if (qs.length < 3) return null;
  const max = qs.length >= 6 ? 2 : 1;
  // whole name or word beats a typed prefix
  let best = Infinity;
  for (const n of flat) best = Math.min(best, distance(qs, n) * 2, distance(qs, n.slice(0, qs.length)) * 2 + 1);
  for (const n of names) for (const w of n.split(' ')) best = Math.min(best, distance(qs, w) * 2);
  return best <= max * 2 + 1 ? 4 + best : null;
}

/** Matching inspectors, closest first. */
export function rankInspectors<T extends Inspector>(query: string, list: T[]): T[] {
  const byName = (a: T, b: T) => a.displayName.localeCompare(b.displayName, 'he');
  const q = normalizeName(query);
  if (!q) return [...list].sort(byName);
  const qs = q.replace(/ /g, '');
  return list
    .map((p) => ({ p, s: score(q, qs, p) }))
    .filter((x): x is { p: T; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s || byName(a.p, b.p))
    .map((x) => x.p);
}
