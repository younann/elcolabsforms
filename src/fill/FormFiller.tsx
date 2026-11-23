import { Link } from 'react-router-dom';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle, CircleNotch, ListChecks, CloudSlash, Checks, ListBullets, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react';
import { Banner, Button, Sheet, StatusBadge, cx, toast, type SubmissionStatus } from '../ui';
import { api, ApiError } from '../lib/api';
import { clearLocal, createAutosave, dataHash, readLocal, sameData, type Autosave, type SaveStatus } from '../lib/autosave';
import type { AttachmentRef, Field, FormData, FormDef, Section } from '../../shared/forms/types';
import { hasOkChecks, markSectionNACount, markSectionOKCount, validateForSubmit, type Missing } from '../../shared/forms/validate';
import { FillContext, fieldDomId, sectionDomId, type Attachment, type FillCtx, type FillMode } from './context';
import { FieldRenderer } from './FieldRenderer';
import { SectionNav, type SectionItem } from './SectionNav';
import { naLabel, sectionProgress } from './progress';
import { applyRules } from '../../shared/forms/rules';

export type SubmissionRow = {
  id: string;
  formId: string;
  formVersion: number;
  status: SubmissionStatus;
  data: FormData;
  updatedAt: string;
  reviewNote?: string | null;
  revision: number;
};

export type FormFillerProps = {
  def: FormDef;
  submission: SubmissionRow;
  initialData: FormData;
  /** Data came from the device copy and still needs a server save. */
  unsaved?: boolean;
  attachments: Attachment[];
  mode?: FillMode;
  readOnly?: boolean;
  /** Called after a successful submit. */
  onSubmitted?: (s: SubmissionRow) => void;
  /** Replaces the submit button, e.g. admin actions. */
  actions?: ReactNode;
  /** Line under the title linking to the job. */
  context?: { jobId: string; text: string };
};

export const draftKey = (id: string) => `draft:${id}`;

type Conflict = { server: FormData; serverUpdatedAt: string; mine?: FormData };

const SIMPLE = new Set<Field['type']>(['text', 'number', 'date', 'time', 'choice']);

// groups fields: simple inputs into a grid, checks into a list
function groups(fields: Field[]) {
  const out: { kind: 'grid' | 'checks' | 'block'; fields: Field[] }[] = [];
  for (const f of fields) {
    const kind = SIMPLE.has(f.type) ? 'grid' : f.type === 'check' ? 'checks' : 'block';
    const last = out.at(-1);
    if (last && last.kind === kind && kind !== 'block') last.fields.push(f);
    else out.push({ kind, fields: [f] });
  }
  return out;
}

export function jumpToField(fieldId: string) {
  const el = document.getElementById(fieldDomId(fieldId));
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  const target = el.matches('input,textarea,select') ? el : (el.querySelector<HTMLElement>('input,textarea,select,[role=radio],button') ?? el);
  target.focus({ preventScroll: true });
  el.setAttribute('data-flash', '');
  setTimeout(() => el.removeAttribute('data-flash'), 1600);
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry(): void }) {
  const map = {
    saved: { Icon: CheckCircle, text: 'נשמר', cls: 'text-muted' },
    saving: { Icon: CircleNotch, text: 'שומר…', cls: 'text-muted' },
    offline: { Icon: CloudSlash, text: 'אין חיבור, נשמר במכשיר', cls: 'text-warning' },
    error: { Icon: WarningCircle, text: 'השמירה נכשלה, נסה שוב', cls: 'text-danger' },
    conflict: { Icon: WarningCircle, text: 'הטופס השתנה במכשיר אחר', cls: 'text-danger' },
    locked: { Icon: WarningCircle, text: 'הטופס כבר הוגש – טען מחדש', cls: 'text-danger' },
  }[status];
  const body = (
    <>
      <map.Icon className={cx('size-[18px] shrink-0', status === 'saving' && 'animate-spin')} weight={status === 'saved' ? 'fill' : 'regular'} aria-hidden />
      <span className="truncate">{map.text}</span>
    </>
  );
  const cls = cx('inline-flex min-h-11 min-w-0 items-center gap-1.5 text-[14px] font-medium', map.cls);
  return status === 'error' || status === 'locked' ? (
    <button
      type="button"
      onClick={status === 'locked' ? () => window.location.reload() : onRetry}
      className={cx(cls, 'press rounded-ctl px-1')}
      data-testid="save-status"
      data-status={status}
    >
      {body}
    </button>
  ) : (
    <span role="status" className={cls} data-testid="save-status" data-status={status}>
      {body}
    </span>
  );
}

/** Generic filler for any form definition; reused by admin review. */
export function FormFiller({
  def,
  submission,
  initialData,
  unsaved,
  attachments: initialAtts,
  mode = 'inspector',
  readOnly = false,
  onSubmitted,
  actions,
  context,
}: FormFillerProps) {
  // device copy based on another server version
  const [conflict, setConflict] = useState<Conflict | null>(() => {
    if (readOnly || unsaved) return null;
    const local = readLocal<FormData>(draftKey(submission.id));
    if (!local?.base || Date.parse(local.base) === Date.parse(submission.updatedAt)) return null;
    if (sameData(local.data, initialData) || local.sent?.includes(dataHash(initialData))) return null;
    return { server: initialData, serverUpdatedAt: submission.updatedAt, mine: local.data };
  });
  const [data, setData] = useState<FormData>(() => conflict?.mine ?? initialData);
  // latest data for event handlers
  const dataRef = useRef(data);
  dataRef.current = data;
  const [atts, setAtts] = useState<Attachment[]>(initialAtts);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [navOpen, setNavOpen] = useState(false);
  const [missing, setMissing] = useState<Missing[] | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<string | undefined>(def.sections[0]?.id);
  const saver = useRef<Autosave<FormData> | null>(null);
  const initial = useRef(data);
  const locked = readOnly || !!conflict;

  // drafts of forms no longer editable are stale
  useEffect(() => {
    if (readOnly) clearLocal(draftKey(submission.id));
  }, [readOnly, submission.id]);

  // created in an effect so strict-mode remounts get a live instance
  useEffect(() => {
    const a = createAutosave<FormData>({
      storageKey: draftKey(submission.id),
      base: submission.updatedAt,
      save: async (d, base) => {
        const r = await api<{ submission: SubmissionRow }>(`/api/submissions/${submission.id}`, {
          method: 'PATCH',
          json: { data: d, updatedAt: base ?? submission.updatedAt },
        });
        return { updatedAt: r.submission.updatedAt };
      },
      // after a 409; autosave tells our own saves from other devices
      fetchServer: async () => {
        const r = await api<{ submission: SubmissionRow }>(`/api/submissions/${submission.id}`);
        return { data: r.submission.data ?? {}, updatedAt: r.submission.updatedAt };
      },
      onConflict: (srv) => setConflict({ server: srv.data, serverUpdatedAt: srv.updatedAt }),
    });
    saver.current = a;
    const off = a.subscribe(setStatus);
    if (unsaved && !readOnly) a.update(initial.current);
    const onHide = () => {
      if (document.visibilityState === 'hidden') void a.flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      off();
      if (saver.current === a) saver.current = null;
      void a.flush().finally(() => a.dispose());
    };
  }, [submission.id, submission.updatedAt, unsaved, readOnly]);

  useEffect(() => {
    if (data !== initial.current && !readOnly) saver.current?.update(data);
  }, [data, readOnly]);

  function takeServer(c: Conflict) {
    saver.current?.takeServer(c.serverUpdatedAt);
    clearLocal(draftKey(submission.id));
    initial.current = c.server;
    setData(c.server);
    setConflict(null);
  }

  function keepMine(c: Conflict) {
    saver.current?.keepMine(c.serverUpdatedAt, data);
    setConflict(null);
  }

  const onChange = useCallback((id: string, v: unknown) => setData((d) => applyRules(def, d, { ...d, [id]: v })), [def]);

  const upload = useCallback<FillCtx['upload']>(
    async (fieldId, kind, blob, name = 'file') => {
      const fd = new FormData();
      fd.set('submissionId', submission.id);
      fd.set('fieldId', fieldId);
      fd.set('kind', kind);
      fd.set('file', blob, name);
      const r = await api<{ id: string; url: string }>('/api/files', { method: 'POST', body: fd });
      const a: Attachment = { id: r.id, url: r.url, fieldId, kind };
      setAtts((list) => [...list, a]);
      return a;
    },
    [submission.id],
  );

  const remove = useCallback<FillCtx['remove']>(async (id) => {
    await api(`/api/files/${id}`, { method: 'DELETE' });
    setAtts((list) => list.filter((a) => a.id !== id));
  }, []);

  const ctx = useMemo<FillCtx>(
    () => ({ submissionId: submission.id, mode, readOnly, attachments: atts, upload, remove }),
    [submission.id, mode, readOnly, atts, upload, remove],
  );

  const refs: AttachmentRef[] = useMemo(() => atts.map(({ id, fieldId, kind }) => ({ id, fieldId, kind })), [atts]);
  const items: SectionItem[] = useMemo(
    () => def.sections.map((s) => ({ section: s, ...sectionProgress(def, s, data, refs) })),
    [def, data, refs],
  );
  const totals = items.reduce((a, i) => ({ done: a.done + i.done, total: a.total + i.total }), { done: 0, total: 0 });

  // live list once a submit failed
  const liveMissing = useMemo(() => (missing ? validateForSubmit(def, data, refs).missing : []), [missing, def, data, refs]);
  const missingIds = useMemo(() => new Set(liveMissing.map((m) => m.fieldId)), [liveMissing]);

  // highlight the section in view
  useEffect(() => {
    const els = def.sections.map((s) => document.getElementById(sectionDomId(s.id))).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setCurrent(vis[0].target.id.replace(/^section-/, ''));
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [def]);

  function jumpSection(id: string) {
    setNavOpen(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() =>
      document.getElementById(sectionDomId(id))?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }),
    );
  }

  function markNA(sectionId: string) {
    const r = markSectionNACount(def, sectionId, dataRef.current);
    dataRef.current = r.data;
    setData(r.data);
    toast.success(r.changed > 0 ? `${r.changed} סעיפים סומנו` : 'כל הסעיפים כבר סומנו');
  }

  function markOK(sectionId: string) {
    const r = markSectionOKCount(def, sectionId, dataRef.current);
    dataRef.current = r.data;
    setData(r.data);
    toast.success(r.changed > 0 ? `${r.changed} סעיפים סומנו כתקין` : 'כל הסעיפים כבר סומנו');
  }

  async function submit() {
    setSubmitting(true);
    try {
      await saver.current?.flush();
      if (saver.current && saver.current.status() !== 'saved') {
        toast.error('הטופס עדיין לא נשמר בשרת. בדוק את החיבור ונסה שוב');
        return;
      }
      const r = await api<{ submission: SubmissionRow }>(`/api/submissions/${submission.id}/action`, {
        method: 'POST',
        json: { action: 'submit' },
      });
      setMissing(null);
      toast.success('הטופס נשלח לאישור');
      onSubmitted?.(r.submission);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && Array.isArray(e.body.missing)) {
        setMissing(e.body.missing as Missing[]);
        setShowMissing(true);
      } else if (e instanceof ApiError && e.status !== 401) {
        toast.error(e.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const sectionTitle = (id: string) => def.sections.find((s) => s.id === id)?.title ?? '';

  return (
    <FillContext.Provider value={ctx}>
      <div
        className={cx(
          'pb-[calc(6rem+var(--safe-bottom))] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8 lg:pb-32',
          !!actions && 'max-sm:pb-[calc(9.5rem+var(--safe-bottom))]',
        )}
      >
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--safe-top)+4.5rem)] max-h-[calc(100dvh-var(--safe-top)-10rem)] overflow-y-auto overscroll-contain pb-4">
            <SectionNav items={items} current={current} onJump={jumpSection} onMarkNA={locked ? undefined : markNA} />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="mb-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={submission.status} />
              {def.docNumber && <span className="text-[13px] text-muted tabular-nums">{def.docNumber}</span>}
            </div>
            <h1 className="mt-2 text-[22px] leading-tight font-semibold tracking-tight text-balance md:text-2xl">{def.title}</h1>
            {context && (
              <Link to={`/jobs/${context.jobId}`} className="mt-1 inline-block text-[15px] font-medium text-accent underline-offset-2 hover:underline" data-testid="job-context">
                {context.text}
              </Link>
            )}
          </header>

          {conflict && (
            <Banner
              tone="warning"
              title="הטופס השתנה במכשיר אחר"
              className="mb-5"
              action={
                <>
                  <Button onClick={() => takeServer(conflict)}>טען את הגרסה מהשרת</Button>
                  <Button variant="secondary" onClick={() => keepMine(conflict)}>
                    השאר את השינויים שלי
                  </Button>
                </>
              }
            >
              השינויים במכשיר הזה שונים מהגרסה השמורה בשרת. בחר איזו גרסה לשמור.
            </Banner>
          )}

          {submission.status === 'returned' && submission.reviewNote && (
            <Banner tone="warning" title="הוחזר לתיקון" className="mb-5">
              <span className="whitespace-pre-wrap">{submission.reviewNote}</span>
            </Banner>
          )}

          <div className="flex flex-col gap-5">
            {def.sections.map((s, i) => (
              <SectionCard
                key={s.id}
                section={s}
                item={items[i]}
                data={data}
                onChange={onChange}
                readOnly={locked}
                missingIds={missingIds}
                onMarkNA={markNA}
                onMarkOK={hasOkChecks(def, s) ? markOK : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="safe-x fixed inset-x-0 bottom-0 z-20 lg:start-(--nav-w) material border-t-[0.5px] border-separator pt-2.5 pb-[max(0.625rem,var(--safe-bottom))]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <Button variant="secondary" className="lg:hidden" icon={<ListBullets className="size-5" aria-hidden />} onClick={() => setNavOpen(true)}>
            <span className="tabular-nums" dir="ltr">
              {totals.done}/{totals.total}
            </span>
            <span className="sr-only">סעיפים</span>
          </Button>
          {!readOnly && (
            <div className="min-w-0 flex-1">
              <SaveIndicator status={status} onRetry={() => void saver.current?.flush()} />
            </div>
          )}
          {actions ? (
            // several actions get their own row on phones; a lone icon stays inline
            <div className="flex min-w-0 max-sm:[&:has(>*>:is(a,button)~:is(a,button))]:basis-full">{actions}</div>
          ) : (
            !readOnly &&
            mode === 'inspector' && (
              <Button variant="accent" loading={submitting} disabled={!!conflict} icon={<PaperPlaneTilt className="size-5 -scale-x-100" aria-hidden />} onClick={submit}>
                שליחה לאישור
              </Button>
            )
          )}
        </div>
      </div>

      <Sheet open={navOpen} onClose={() => setNavOpen(false)} title="סעיפים">
        <SectionNav items={items} current={current} onJump={jumpSection} onMarkNA={locked ? undefined : markNA} />
      </Sheet>

      <Sheet open={showMissing} onClose={() => setShowMissing(false)} title="חסרים פרטים לשליחה">
        {liveMissing.length === 0 ? (
          <p className="py-4 text-center text-muted">הכול מולא. אפשר לשלוח שוב.</p>
        ) : (
          <>
            <p className="mb-3 text-[15px] text-muted">
              <span className="tabular-nums">{liveMissing.length}</span> פריטים חסרים. הקש על פריט כדי לעבור אליו.
            </p>
            <ul className="flex flex-col gap-1" data-testid="missing-list">
              {liveMissing.map((m, i) => (
                <Fragment key={m.fieldId}>
                  {(i === 0 || liveMissing[i - 1].sectionId !== m.sectionId) && (
                    <li className="px-1 pt-3 pb-1 text-[13px] font-semibold text-muted">{sectionTitle(m.sectionId)}</li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMissing(false);
                        setTimeout(() => jumpToField(m.fieldId), 60);
                      }}
                      className="press flex min-h-11 w-full items-center rounded-ctl px-3 py-2 text-start text-[15px] leading-snug transition-[transform,background-color] duration-150 ease-snap hover:bg-surface-2 active:scale-[0.98]"
                    >
                      <span className="line-clamp-2">{m.label}</span>
                    </button>
                  </li>
                </Fragment>
              ))}
            </ul>
          </>
        )}
      </Sheet>
    </FillContext.Provider>
  );
}

type SectionCardProps = {
  section: Section;
  item: SectionItem;
  data: FormData;
  onChange(id: string, v: unknown): void;
  readOnly: boolean;
  missingIds: Set<string>;
  onMarkNA(id: string): void;
  onMarkOK?: (id: string) => void;
};

function SectionCard({ section: s, item, data, onChange, readOnly, missingIds, onMarkNA, onMarkOK }: SectionCardProps) {
  const na = naLabel(s);
  const complete = item.total > 0 && item.done === item.total;
  let topic: string | undefined;
  return (
    <section id={sectionDomId(s.id)} aria-labelledby={`${sectionDomId(s.id)}-h`} className="scroll-mt-20 rounded-box bg-surface shadow-[var(--shadow-card)] px-4 py-4 md:px-6 md:py-5">
      <div className="mb-3 flex items-center gap-3">
        <h2 id={`${sectionDomId(s.id)}-h`} className="min-w-0 flex-1 text-lg leading-snug font-semibold">
          {s.title}
        </h2>
        {item.total > 0 && (
          <span
            className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums', complete ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted')}
            dir="ltr"
          >
            {item.done}/{item.total}
          </span>
        )}
      </div>
      {na && !readOnly && !complete && (
        <div className="-ms-2 mb-1 flex flex-wrap gap-x-2">
          {onMarkOK && (
            <Button variant="ghost" className="text-success!" icon={<ListChecks className="size-5" aria-hidden />} onClick={() => onMarkOK(s.id)}>
              סמן את השאר כתקין
            </Button>
          )}
          <Button variant="ghost" className="text-accent!" icon={<Checks className="size-5" aria-hidden />} onClick={() => onMarkNA(s.id)}>
            {na}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {groups(s.fields).map((g, gi) =>
          g.kind === 'grid' ? (
            <div key={gi} className="grid gap-4 sm:grid-cols-2">
              {g.fields.map((f) => (
                <Slot key={f.id} missing={missingIds.has(f.id)}>
                  <FieldRenderer field={f} value={data[f.id]} onChange={onChange} disabled={readOnly} />
                </Slot>
              ))}
            </div>
          ) : g.kind === 'checks' ? (
            <div key={gi} className="divide-y divide-border">
              {g.fields.map((f) => {
                const t = f.type === 'check' ? f.topic : undefined;
                const showTopic = t && t !== topic && t !== s.title;
                topic = t ?? topic;
                return (
                  <Fragment key={f.id}>
                    {showTopic && <h3 className="pt-4 pb-1 text-[15px] font-semibold text-muted">{t}</h3>}
                    <Slot missing={missingIds.has(f.id)}>
                      <FieldRenderer field={f} value={data[f.id]} onChange={onChange} disabled={readOnly} />
                    </Slot>
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <Slot key={gi} missing={missingIds.has(g.fields[0].id)}>
              <FieldRenderer field={g.fields[0]} value={data[g.fields[0].id]} onChange={onChange} disabled={readOnly} />
            </Slot>
          ),
        )}
      </div>
    </section>
  );
}

function Slot({ missing, children }: { missing: boolean; children: ReactNode }) {
  return (
    <div
      className={cx(
        'relative -mx-2 px-2 transition-[background-color] duration-300',
        missing && 'rounded-ctl bg-danger-soft/60 before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-danger',
      )}
      data-missing={missing || undefined}
    >
      {children}
    </div>
  );
}
