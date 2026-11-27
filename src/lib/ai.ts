import { api } from './api';
import type { AiMessage, AiResult } from '../../shared/ai';

export type { AiMessage };
export type AiAnswer = { text: string; sources: { title: string; uri: string }[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Asks, then waits for the background answer. */
export async function askAi(formId: string, messages: AiMessage[]): Promise<AiAnswer> {
  const { id } = await api<{ id: string }>('/api/ai', { method: 'POST', json: { formId, messages } });
  for (let i = 0; i < 80; i++) {
    await sleep(1500);
    const r = await api<AiResult>(`/api/ai/${id}`);
    if (r.status === 'done') return { text: r.text, sources: r.sources ?? [] };
    if (r.status === 'failed') throw new Error(r.error);
  }
  throw new Error('התשובה מתעכבת. נסו שוב');
}

// answers come as markdown; show plain text
export const plainText = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[*-]\s+/gm, '• ');
