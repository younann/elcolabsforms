import { useEffect, useRef, useState } from 'react';
import { PaperPlaneRight, Sparkle } from '@phosphor-icons/react';
import { ApiError } from '../lib/api';
import { askAi, plainText, type AiAnswer, type AiMessage } from '../lib/ai';
import { Button, Sheet, TextArea, cx } from '../ui';

type Turn = AiMessage & { sources?: AiAnswer['sources']; error?: boolean };

/** "Ask the AI" about the standard of this form type; kept for the visit only. */
export function AiChat({ formId, formName }: { formId: string; formName: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) end.current?.scrollIntoView?.({ block: 'end' });
  }, [open, turns, busy]);

  async function send() {
    const text = q.trim();
    if (!text || busy) return;
    // failed answers are not sent back
    const history = [...turns.filter((t) => !t.error).map(({ role, text }) => ({ role, text })), { role: 'user' as const, text }];
    setTurns((t) => [...t, { role: 'user', text }]);
    setQ('');
    setBusy(true);
    try {
      const a = await askAi(formId, history.slice(-20));
      setTurns((t) => [...t, { role: 'model', text: a.text, sources: a.sources }]);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      const msg = navigator.onLine === false ? 'אין חיבור לאינטרנט' : e instanceof Error ? e.message : 'השאלה נכשלה';
      setTurns((t) => [...t, { role: 'model', text: msg, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" icon={<Sparkle className="size-5" aria-hidden />} onClick={() => setOpen(true)} data-testid="ai-open">
        שאל את ה-AI
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`שאל את ה-AI · ${formName}`}
        footer={
          <div className="flex items-end gap-2 [&>*:first-child]:flex-1">
            <TextArea
              label="השאלה"
              rows={2}
              maxLength={4000}
              placeholder="לדוגמה: האם בטופס הזה צריך לבדוק גלאים בתקרה כפולה?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button variant="accent" aria-label="שליחה" loading={busy} disabled={!q.trim()} icon={<PaperPlaneRight className="size-5 -scale-x-100" aria-hidden />} onClick={send} data-testid="ai-send" />
          </div>
        }
      >
        <div className="flex flex-col gap-3" data-testid="ai-chat">
          {!turns.length && <p className="text-[15px] leading-relaxed text-muted">שאלו על התקן של סוג הטופס הזה. ה-AI עונה לפי מסמכי התקן שהמשרד העלה, ומחפש באינטרנט כשצריך.</p>}
          {turns.map((t, i) => (
            <div
              key={i}
              className={cx(
                'max-w-[90%] rounded-box px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-line',
                t.role === 'user' ? 'self-start bg-accent text-accent-fg' : t.error ? 'self-end bg-danger-soft text-danger' : 'self-end bg-surface-2',
              )}
            >
              {t.role === 'model' && !t.error ? plainText(t.text) : t.text}
              {!!t.sources?.length && (
                <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-[13px]">
                  {t.sources.slice(0, 5).map((s) => (
                    <li key={s.uri}>
                      <a href={s.uri} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {busy && <div className="self-end rounded-box bg-surface-2 px-3.5 py-2.5 text-[15px] text-muted">חושב…</div>}
          {!!turns.length && <p className="text-[12px] text-muted">ה-AI עלול לטעות. בדקו מול התקן עצמו.</p>}
          <div ref={end} />
        </div>
      </Sheet>
    </>
  );
}
