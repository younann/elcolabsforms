import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClockCounterClockwise, WarningOctagon } from '@phosphor-icons/react';
import { api, ApiError } from '../lib/api';
import { preferLocal } from '../lib/autosave';
import { fmtTime, type AuditEntry } from '../lib/submissions';
import { Button, EmptyState, Sheet } from '../ui';
import { getForm } from '../../shared/forms';
import type { Field, FormData, FormDef } from '../../shared/forms/types';
import { draftKey, type SubmissionRow } from '../fill/FormFiller';
import type { Attachment } from '../fill/context';

export type FullSubmission = SubmissionRow & {
  revision: number;
  inspectorId: string;
  pdfKey: string | null;
  sendError: string | null;
  parentId: string | null;
  approvedBy: string | null;
  emailedAt: string | null;
};

export type Detail = {
  def: FormDef;
  submission: FullSubmission;
  data: FormData;
  fromLocal: boolean;
  attachments: Attachment[];
  audit: AuditEntry[];
};

/** Loads a submission; editable statuses prefer the device copy. */
export function useSubmission(id: string, editable: (s: FullSubmission) => boolean) {
  const [state, setState] = useState<Detail | { error: string } | null>(null);
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setState(null);
      try {
        const r = await api<{ submission: FullSubmission; attachments: Attachment[]; audit?: AuditEntry[] }>(`/api/submissions/${id}`);
        const def = getForm(r.submission.formId, r.submission.formVersion);
        const picked = editable(r.submission)
          ? preferLocal(draftKey(id), r.submission.data ?? {}, r.submission.updatedAt)
          : { data: r.submission.data ?? {}, fromLocal: false };
        setState({ def, submission: r.submission, data: picked.data, fromLocal: picked.fromLocal, attachments: r.attachments, audit: r.audit ?? [] });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
        if (!quiet) setState({ error: e instanceof Error ? e.message : 'טעינת הטופס נכשלה' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { state, load };
}

export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="טוען" className="flex flex-col gap-5">
      <div className="h-5 w-24 rounded-full bg-surface-2" />
      <div className="h-7 w-3/4 rounded-full bg-surface-2" />
      {[0, 1].map((i) => (
        <div key={i} className="rounded-box border border-border bg-surface p-5">
          <div className="h-5 w-40 rounded-full bg-surface-2" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="h-12 rounded-ctl bg-surface-2" />
            <div className="h-12 rounded-ctl bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailError({ error, onRetry }: { error: string; onRetry(): void }) {
  return (
    <EmptyState icon={<WarningOctagon />} title="לא ניתן לפתוח את הטופס" action={<Button onClick={onRetry}>נסה שוב</Button>}>
      {error}
    </EmptyState>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="press -ms-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-[15px] font-medium text-muted transition-[transform,color] duration-150 hover:text-text active:scale-[0.97]"
    >
      <ArrowRight className="size-[18px]" aria-hidden />
      {label}
    </Link>
  );
}

const ACTIONS: Record<string, string> = {
  create: 'נוצר',
  submit: 'נשלח לאישור',
  return: 'הוחזר לתיקון',
  approve: 'אושר ונשלח להפקה',
  retry: 'שליחה חוזרת',
  reopen: 'נפתח כגרסה חדשה',
  edit: 'שינוי שדה',
};

function fieldLabel(def: FormDef, id: string | null) {
  if (!id) return '';
  const f = def.sections.flatMap((s) => s.fields).find((x) => x.id === id) as Field | undefined;
  if (!f) return id;
  if ('label' in f) return f.label;
  if (f.type === 'check') return [f.clause, f.text].filter(Boolean).join(' ');
  return id;
}

function short(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'ריק';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object' && !Array.isArray(v) && 'answer' in v) {
    const c = v as { answer?: string; active?: string; note?: string };
    return [c.answer, c.active, c.note].filter(Boolean).join(', ') || 'ריק';
  }
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

/** Admin-only list of who did what. */
export function AuditButton({ def, audit }: { def: FormDef; audit: AuditEntry[] }) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || Object.keys(names).length) return;
    api<{ users: { id: string; displayName: string }[] }>('/api/users')
      .then((r) => setNames(Object.fromEntries(r.users.map((u) => [u.id, u.displayName]))))
      .catch(() => {});
  }, [open, names]);

  return (
    <>
      <Button variant="secondary" aria-label="היסטוריית שינויים" onClick={() => setOpen(true)} className="px-3">
        <ClockCounterClockwise className="size-5" aria-hidden />
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="היסטוריית שינויים">
        {audit.length === 0 ? (
          <p className="py-4 text-center text-muted">אין רישומים</p>
        ) : (
          <ol className="flex flex-col" data-testid="audit-list">
            {[...audit].reverse().map((a) => (
              <li key={a.id} className="border-b border-border py-3 last:border-b-0">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 text-[15px] font-semibold">{ACTIONS[a.action] ?? a.action}</span>
                  <time className="shrink-0 text-[13px] text-muted tabular-nums" dateTime={a.at}>
                    {fmtTime(a.at)}
                  </time>
                </div>
                <p className="text-sm text-muted">{names[a.userId] ?? ''}</p>
                {a.action === 'edit' && (
                  <div className="mt-1.5 text-[15px] leading-relaxed">
                    <p className="line-clamp-2 font-medium">{fieldLabel(def, a.fieldId)}</p>
                    <p className="text-muted">
                      <span className="line-through decoration-danger/60">{short(a.oldValue)}</span>
                      <span aria-hidden> ← </span>
                      <span className="sr-only">שונה ל</span>
                      <span className="text-text">{short(a.newValue)}</span>
                    </p>
                  </div>
                )}
                {a.note && (a.action === 'return' || a.action === 'approve') && <p className="mt-1.5 text-[15px] whitespace-pre-wrap">{a.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </Sheet>
    </>
  );
}
