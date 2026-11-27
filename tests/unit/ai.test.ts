import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stds = vi.hoisted(() => ({ list: [] as unknown[], updates: [] as unknown[] }));
vi.mock('../../server/standards', () => ({
  stdKey: (id: string) => `std/${id}.pdf`,
  listStandards: async () => stds.list,
  updateStandard: async (id: string, patch: unknown) => void stds.updates.push({ id, patch }),
}));
vi.mock('../../server/blobs', () => ({ getBlob: async () => ({ data: new TextEncoder().encode('%PDF-1.4').buffer, contentType: 'application/pdf' }) }));

import { AiError, askGemini, buildRequest, parseAnswer, systemPrompt } from '../../server/ai';
import { AiAsk } from '../../shared/ai';
import { plainText } from '../../src/lib/ai';

const ok = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers });
const answer = { candidates: [{ content: { parts: [{ text: 'לפי סעיף 5.2' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://a.example', title: 'A' } }, { web: { uri: 'https://a.example' } }] } }] };

describe('ai prompt and parsing', () => {
  it('names the form, its standard and attached docs', () => {
    const p = systemPrompt('f1220', ['ת"י 1220 חלק 3']);
    expect(p).toContain('ת"י 1220 חלק 3');
    expect(p).toContain('אל תמציא מספרי סעיפים');
    expect(p).toContain('בדיקות הטופס');
  });

  it('attaches files to the first question only, search optional', () => {
    const files = [{ name: 'files/x', uri: 'https://g/x', expiresAt: '' }];
    const msgs = [
      { role: 'user' as const, text: 'א' },
      { role: 'model' as const, text: 'ב' },
      { role: 'user' as const, text: 'ג' },
    ];
    const r = buildRequest({ system: 's', files, messages: msgs, search: true });
    expect(r.contents[0].parts[0]).toEqual({ file_data: { mime_type: 'application/pdf', file_uri: 'https://g/x' } });
    expect(r.contents[2].parts).toEqual([{ text: 'ג' }]);
    expect(r.tools).toEqual([{ google_search: {} }]);
    expect('tools' in buildRequest({ system: 's', files, messages: msgs, search: false })).toBe(false);
  });

  it('reads text and dedups web sources', () => {
    expect(parseAnswer(answer)).toEqual({ text: 'לפי סעיף 5.2', sources: [{ title: 'A', uri: 'https://a.example' }] });
    expect(parseAnswer({})).toEqual({ text: '', sources: [] });
  });

  it('validates the question', () => {
    expect(AiAsk.safeParse({ formId: 'gas', messages: [{ role: 'user', text: 'שאלה' }] }).success).toBe(true);
    expect(AiAsk.safeParse({ formId: 'nope', messages: [{ role: 'user', text: 'שאלה' }] }).success).toBe(false);
    expect(AiAsk.safeParse({ formId: 'gas', messages: [{ role: 'model', text: 'x' }] }).success).toBe(false);
  });

  it('strips markdown for display', () => {
    expect(plainText('## כותרת\n**חשוב**\n- סעיף')).toBe('כותרת\nחשוב\n• סעיף');
  });
});

describe('askGemini', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GEMINI_API_KEY', 'k');
    stds.list = [];
    stds.updates = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it('needs a key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    await expect(askGemini('gas', [{ role: 'user', text: 'x' }])).rejects.toThrow('עדיין לא הוגדר');
  });

  it('uploads an expired standard, then answers with it', async () => {
    stds.list = [{ id: 's1', name: 'ת"י 1597', formIds: ['gas'], size: 8, createdAt: '' }, { id: 's2', name: 'other', formIds: ['f536'], size: 8, createdAt: '' }];
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 200, headers: { 'x-goog-upload-url': 'https://up/1' } }))
      .mockResolvedValueOnce(ok({ file: { name: 'files/1', uri: 'https://g/1', state: 'ACTIVE', expirationTime: '2999-01-01T00:00:00Z' } }))
      .mockResolvedValueOnce(ok(answer));
    const r = await askGemini('gas', [{ role: 'user', text: 'שאלה' }]);
    expect(r.text).toBe('לפי סעיף 5.2');
    expect(stds.updates).toEqual([{ id: 's1', patch: { gemini: { name: 'files/1', uri: 'https://g/1', expiresAt: '2999-01-01T00:00:00Z' } } }]);
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.contents[0].parts[0].file_data.file_uri).toBe('https://g/1');
    expect(fetchMock.mock.calls[2][1].headers['x-goog-api-key']).toBe('k');
  });

  it('reuses a fresh upload and falls back without search', async () => {
    stds.list = [{ id: 's1', name: 'n', formIds: ['gas'], size: 8, createdAt: '', gemini: { name: 'files/1', uri: 'https://g/1', expiresAt: '2999-01-01T00:00:00Z' } }];
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 400 })).mockResolvedValueOnce(ok(answer));
    await askGemini('gas', [{ role: 'user', text: 'שאלה' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toBeDefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tools).toBeUndefined();
  });

  it('says when the daily limit is reached', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 429 }));
    const e = await askGemini('gas', [{ role: 'user', text: 'x' }]).catch((x) => x);
    expect(e).toBeInstanceOf(AiError);
    expect(e.message).toContain('מגבלת השימוש היומית');
  });
});
