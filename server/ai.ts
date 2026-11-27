// AI chat: Gemini answers from the form's standards; web search when enabled
import { getForm } from '../shared/forms';
import { certTemplate } from '../shared/certificates';
import type { AiMessage } from '../shared/ai';
import { getBlob } from './blobs';
import { listStandards, stdKey, updateStandard, type GeminiFile, type Standard } from './standards';

const BASE = 'https://generativelanguage.googleapis.com';
// google retires models; a busy or retired one falls through to the next
const models = () => (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ['gemini-3.5-flash', 'gemini-flash-lite-latest']);
// free keys get no search quota
const searchOn = () => process.env.GEMINI_SEARCH === '1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function fail(r: Response): Promise<never> {
  const body = await r.text().catch(() => '');
  console.error('gemini', r.status, body.slice(0, 500));
  if (r.status === 429) throw new AiError(429, 'הגעתם למגבלת השימוש היומית של ה-AI. נסו שוב מחר');
  throw new AiError(r.status, 'ה-AI לא זמין כרגע. נסו שוב בעוד רגע');
}

/** Instructions: who asks, which form and standard, the form's checks. */
export function systemPrompt(formId: string | undefined, docs: string[], search = false): string {
  const def = formId ? getForm(formId) : null;
  const standard = formId ? (certTemplate(formId)?.standard ?? '') : '';
  const checks = (def?.sections ?? [])
    .flatMap((s) => s.fields)
    .flatMap((f) => (f.type === 'check' ? [`${f.clause ? `${f.clause} ` : ''}${f.text}`] : []))
    .join('\n')
    .slice(0, 8000);
  return [
    'אתה עוזר לצוות של מעבדה לבדיקות מערכות גילוי וכיבוי אש בישראל.',
    def ? `סוג הטופס: ${def.title}${standard ? `. התקן: ${standard}` : ''}.` : 'שאלה כללית, לא על טופס מסוים.',
    docs.length ? `מסמכי התקן המצורפים: ${docs.join(', ')}. ענה קודם כול לפיהם וציין שם מסמך ומספר סעיף או עמוד.` : 'לא צורפו מסמכי תקן.',
    search
      ? 'אם התשובה לא נמצאת במסמכים, חפש באינטרנט ואמור במפורש שהתשובה אינה מהמסמכים.'
      : 'אם התשובה לא נמצאת במסמכים, ענה מהידע הכללי שלך ואמור במפורש שהתשובה אינה מהמסמכים.',
    'אל תמציא מספרי סעיפים. אם אינך בטוח, אמור זאת.',
    'ענה בעברית, קצר וברור.',
    checks && `בדיקות הטופס:\n${checks}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildRequest(o: { system: string; files: GeminiFile[]; messages: AiMessage[]; search: boolean; model?: string }) {
  const contents = o.messages.map((m, i) => ({
    role: m.role,
    // standards ride on the first question
    parts: [...(i === 0 ? o.files.map((f) => ({ file_data: { mime_type: 'application/pdf', file_uri: f.uri } })) : []), { text: m.text }],
  }));
  return {
    system_instruction: { parts: [{ text: o.system }] },
    contents,
    ...(o.search ? { tools: [{ google_search: {} }] } : {}),
    // full thinking takes 20s+; low answers in ~5s
    ...(o.model && !o.model.includes('lite') ? { generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } } : {}),
  };
}

type GenResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
};

export function parseAnswer(r: GenResponse): { text: string; sources: { title: string; uri: string }[] } {
  const c = r.candidates?.[0];
  const text = (c?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  const seen = new Set<string>();
  const sources = (c?.groundingMetadata?.groundingChunks ?? []).flatMap((g) => {
    const uri = g.web?.uri;
    if (!uri || seen.has(uri)) return [];
    seen.add(uri);
    return [{ title: g.web?.title || uri, uri }];
  });
  return { text, sources };
}

async function uploadPdf(key: string, bytes: Uint8Array, displayName: string): Promise<GeminiFile> {
  const start = await fetch(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': key,
      'x-goog-upload-protocol': 'resumable',
      'x-goog-upload-command': 'start',
      'x-goog-upload-header-content-length': String(bytes.length),
      'x-goog-upload-header-content-type': 'application/pdf',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) await fail(start);
  const url = start.headers.get('x-goog-upload-url');
  if (!url) throw new AiError(502, 'העלאת התקן ל-AI נכשלה');
  const up = await fetch(url, { method: 'POST', headers: { 'x-goog-upload-offset': '0', 'x-goog-upload-command': 'upload, finalize' }, body: new Blob([bytes as Uint8Array<ArrayBuffer>]) });
  if (!up.ok) await fail(up);
  let f = ((await up.json()) as { file: { name: string; uri: string; state?: string; expirationTime: string } }).file;
  // big pdfs are processed before use
  for (let i = 0; f.state === 'PROCESSING' && i < 60; i++) {
    await sleep(2000);
    const r = await fetch(`${BASE}/v1beta/${f.name}`, { headers: { 'x-goog-api-key': key } });
    if (!r.ok) await fail(r);
    f = (await r.json()) as typeof f;
  }
  if (f.state && f.state !== 'ACTIVE') throw new AiError(502, 'עיבוד התקן ב-AI נכשל');
  return { name: f.name, uri: f.uri, expiresAt: f.expirationTime };
}

// gemini keeps files 48h: reuse while fresh, else upload again
async function geminiFile(key: string, s: Standard): Promise<GeminiFile | null> {
  if (s.gemini && Date.parse(s.gemini.expiresAt) - Date.now() > 60 * 60_000) return s.gemini;
  const b = await getBlob(stdKey(s.id));
  if (!b) return null;
  const g = await uploadPdf(key, new Uint8Array(b.data), s.name);
  await updateStandard(s.id, { gemini: g });
  return g;
}

export async function askGemini(formId: string | undefined, messages: AiMessage[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError(503, 'עוזר ה-AI עדיין לא הוגדר');
  // general questions carry no pdfs: all standards together are too big
  const stds = formId ? (await listStandards()).filter((s) => s.formIds.includes(formId)) : [];
  const files: GeminiFile[] = [];
  for (const s of stds) {
    const f = await geminiFile(key, s);
    if (f) files.push(f);
  }
  // a hung model counts as busy
  const call = (model: string, search: boolean) =>
    fetch(`${BASE}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify(buildRequest({ system: systemPrompt(formId, stds.map((s) => s.name), search), files, messages, search, model })),
      signal: AbortSignal.timeout(45_000),
    }).catch((e) => {
      console.warn('gemini call failed', model, String(e));
      return new Response('{}', { status: 503 });
    });
  let r: Response | null = null;
  for (const model of models()) {
    r = await call(model, searchOn());
    if (!r.ok && searchOn() && [400, 403, 429].includes(r.status)) {
      console.warn('gemini search refused', model, r.status, (await r.text().catch(() => '')).slice(0, 300));
      r = await call(model, false);
    }
    if (r.ok || ![404, 500, 503].includes(r.status)) break;
    console.warn('gemini model unavailable', model, r.status, (await r.text().catch(() => '')).slice(0, 300));
  }
  if (!r!.ok) await fail(r!);
  const out = parseAnswer((await r!.json()) as GenResponse);
  if (!out.text) throw new AiError(502, 'לא התקבלה תשובה. נסו לנסח אחרת');
  return out;
}
