// standards (תקן) pdfs the admin uploads for the AI chat
import { getBlob, putBlob } from './blobs';

export type GeminiFile = { name: string; uri: string; expiresAt: string };
export type Standard = { id: string; name: string; formIds: string[]; size: number; createdAt: string; gemini?: GeminiFile };

export const STD_MAX = 50 * 1024 * 1024;
export const stdKey = (id: string) => `std/${id}.pdf`;
export const partKey = (id: string, n: number) => `std/${id}/part-${n}`;
const INDEX = 'std/index.json';

export async function listStandards(): Promise<Standard[]> {
  const b = await getBlob(INDEX);
  return b ? (JSON.parse(Buffer.from(b.data).toString('utf8')) as Standard[]) : [];
}

// shortcut: one json index, last write wins; move to a table if several admins edit at once
export async function saveStandards(list: Standard[]) {
  await putBlob(INDEX, Buffer.from(JSON.stringify(list)), 'application/json');
}

export async function updateStandard(id: string, patch: Partial<Standard>) {
  const list = await listStandards();
  await saveStandards(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

/** Public view: no gemini cache. */
export const standardView = ({ gemini: _, ...s }: Standard) => s;
