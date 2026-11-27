import { useEffect, useRef, useState } from 'react';
import { PaperPlaneRight, Sparkle } from '@phosphor-icons/react';
import { ApiError } from '../lib/api';
import { askAi, plainText, type AiAnswer, type AiMessage } from '../lib/ai';
import { Button, Select, Sheet, TextArea, cx } from '../ui';
import { FORMS } from '../../shared/forms';

type Turn = AiMessage & { sources?: AiAnswer['sources']; error?: boolean };

/** One conversation; formId undefined means a general question. */
function useChat(formId: string | undefined) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

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
  return { turns, q, setQ, busy, send };
}

type Chat = ReturnType<typeof useChat>;

function ChatLog({ chat, intro, scroll }: { chat: Chat; intro: string; scroll: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroll) end.current?.scrollIntoView?.({ block: 'end' });
  }, [scroll, chat.turns, chat.busy]);
  return (
    <div className="flex flex-col gap-3" data-testid="ai-chat">
      {!chat.turns.length && <p className="text-[15px] leading-relaxed text-muted">{intro}</p>}
      {chat.turns.map((t, i) => (
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
      {chat.busy && <div className="self-end rounded-box bg-surface-2 px-3.5 py-2.5 text-[15px] text-muted">חושב…</div>}
      {!!chat.turns.length && <p className="text-[12px] text-muted">ה-AI עלול לטעות. בדקו מול התקן עצמו.</p>}
      <div ref={end} />
    </div>
  );
}

function ChatInput({ chat, placeholder }: { chat: Chat; placeholder: string }) {
  return (
    <div className="flex items-end gap-2 [&>*:first-child]:flex-1">
      <TextArea
        label="השאלה"
        rows={2}
        maxLength={4000}
        placeholder={placeholder}
        value={chat.q}
        onChange={(e) => chat.setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void chat.send();
          }
        }}
      />
      <Button
        variant="accent"
        aria-label="שליחה"
        loading={chat.busy}
        disabled={!chat.q.trim()}
        icon={<PaperPlaneRight className="size-5 -scale-x-100" aria-hidden />}
        onClick={chat.send}
        data-testid="ai-send"
      />
    </div>
  );
}

/** Button on a form: asks about that form type's standard; kept for the visit only. */
export function AiChat({ formId, formName }: { formId: string; formName: string }) {
  const [open, setOpen] = useState(false);
  const chat = useChat(formId);
  return (
    <>
      <Button variant="secondary" icon={<Sparkle className="size-5" aria-hidden />} onClick={() => setOpen(true)} data-testid="ai-open">
        שאל את ה-AI
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`שאל את ה-AI · ${formName}`} footer={<ChatInput chat={chat} placeholder="לדוגמה: האם בטופס הזה צריך לבדוק גלאים בתקרה כפולה?" />}>
        <ChatLog chat={chat} scroll={open} intro="שאלו על התקן של סוג הטופס הזה. ה-AI עונה לפי מסמכי התקן שהמשרד העלה." />
      </Sheet>
    </>
  );
}

/** Menu page for every role: a general question, or about one form type. */
export function AskPage() {
  const [formId, setFormId] = useState('');
  return (
    <section className="max-w-2xl">
      <h1 className="text-[28px] leading-tight font-bold sm:text-[32px]">שאל את ה-AI</h1>
      <div className="mt-4">
        <Select label="נושא" value={formId} onChange={(e) => setFormId(e.target.value)} data-testid="ai-topic">
          <option value="">שאלה כללית</option>
          {FORMS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.shortTitle}
            </option>
          ))}
        </Select>
      </div>
      {/* a new topic starts a new conversation */}
      <AskConversation key={formId || 'general'} formId={formId || undefined} />
    </section>
  );
}

function AskConversation({ formId }: { formId: string | undefined }) {
  const chat = useChat(formId);
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="rounded-box bg-surface p-4 shadow-[var(--shadow-card)]">
        <ChatLog
          chat={chat}
          scroll={chat.turns.length > 0}
          intro={formId ? 'ה-AI עונה לפי מסמכי התקן שהמשרד העלה לסוג הטופס הזה.' : 'שאלה כללית על בדיקות גילוי וכיבוי אש. לשאלה על תקן מסוים, בחרו נושא למעלה.'}
        />
      </div>
      <ChatInput chat={chat} placeholder="מה תרצו לשאול?" />
    </div>
  );
}
