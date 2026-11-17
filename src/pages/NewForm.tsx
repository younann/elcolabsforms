import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, CircleNotch } from '@phosphor-icons/react';
import { api, ApiError } from '../lib/api';
import { toast } from '../ui';
import { FORMS } from '../../shared/forms';

export function NewForm() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  async function create(formId: string) {
    if (busy) return;
    setBusy(formId);
    try {
      const { submission } = await api<{ submission: { id: string } }>('/api/submissions', { method: 'POST', json: { formId } });
      navigate(`/fill/${submission.id}`, { replace: true });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'יצירת הטופס נכשלה');
      setBusy(null);
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">טופס חדש</h1>
      <p className="mt-1 text-[15px] text-muted">בחר את סוג הבדיקה</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {FORMS.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => create(f.id)}
              disabled={busy !== null}
              className="press flex min-h-20 w-full items-center gap-3 rounded-box border border-border bg-surface px-4 py-3.5 text-start transition-[transform,border-color] duration-150 ease-snap hover:border-border-strong active:scale-[0.98] disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold">{f.shortTitle}</span>
                <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{f.title}</span>
                {f.docNumber && <span className="mt-1 block text-[13px] text-muted tabular-nums">{f.docNumber}</span>}
              </span>
              {busy === f.id ? (
                <CircleNotch className="size-5 shrink-0 animate-spin text-muted" aria-hidden />
              ) : (
                <CaretLeft className="size-5 shrink-0 text-muted" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
