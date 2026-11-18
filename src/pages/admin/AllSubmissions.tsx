import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowClockwise, ArrowsCounterClockwise, FileDoc, FilePdf, FunnelSimple, MagnifyingGlass, WarningOctagon } from '@phosphor-icons/react';
import { api, ApiError } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';
import { act, docxUrl, ilDay, isStuck, listSubmissions, pdfUrl, rowHref, type Summary } from '../../lib/submissions';
import { Button, EmptyState, InspectorPicker, Select, Sheet, TextField, cx, statusLabel, toast } from '../../ui';
import { ListSkeleton, SubmissionRow } from '../../components/SubmissionList';
import { MailLoggedBadge, MailModeBanner, useMailMode } from '../../components/MailMode';
import { FORMS } from '../../../shared/forms';
import type { Status } from '../../../shared/status';

const STATUSES: Status[] = ['submitted', 'returned', 'sending', 'emailed', 'send_failed', 'draft'];
const PAGE = 30;

const smallBtn =
  'press inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-3 text-[15px] font-medium transition-[transform,background-color] duration-150 ease-snap hover:bg-surface-2 active:scale-[0.97]';

export function AllSubmissions() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const f = {
    formId: params.get('form') ?? '',
    inspectorId: params.get('inspector') ?? '',
    status: params.get('status') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    q: params.get('q') ?? '',
  };
  const set = (k: string, v: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v) n.set(k, v);
        else n.delete(k);
        return n;
      },
      { replace: true },
    );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [reopen, setReopen] = useState<Summary | null>(null);
  const mailMode = useMailMode();

  // former inspectors stay searchable here
  const users = useLoad(
    () =>
      api<{ users: { id: string; displayName: string; username: string; role: string }[] }>('/api/users').then((r) =>
        r.users.filter((u) => u.role === 'inspector').map(({ id, displayName, username }) => ({ id, displayName, username })),
      ),
    'users:inspectors',
  );
  const list = useLoad(
    () => listSubmissions({ formId: f.formId, inspectorId: f.inspectorId, status: f.status }),
    `subs:${f.formId}|${f.inspectorId}|${f.status}`,
  );

  // date and text filters run locally
  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return (list.data ?? []).filter((s) => {
      const day = ilDay(s.submittedAt ?? s.createdAt);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      if (q && ![s.siteName, s.testNumber, s.inspectorName].some((v) => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [list.data, f.from, f.to, f.q]);

  const active = [f.formId, f.inspectorId, f.status, f.from, f.to].filter(Boolean).length;

  async function run(s: Summary, action: 'retry' | 'reopen') {
    if (busy) return;
    setBusy(`${s.id}:${action}`);
    try {
      const r = await act(s.id, action);
      if (action === 'reopen') {
        setReopen(null);
        toast.success('נפתחה גרסה חדשה לאישור');
        navigate(`/admin/review/${r.submission.id}`);
        return;
      }
      toast.success('השליחה הופעלה מחדש');
      await list.reload();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');
      if (e instanceof ApiError && e.status === 409) void list.reload();
    } finally {
      setBusy(null);
    }
  }

  const filterFields = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Select label="סוג טופס" value={f.formId} onChange={(e) => set('form', e.target.value)}>
        <option value="">הכול</option>
        {FORMS.map((x) => (
          <option key={x.id} value={x.id}>
            {x.shortTitle}
          </option>
        ))}
      </Select>
      <InspectorPicker
        label="בודק"
        placeholder="כולם"
        options={users.data ?? []}
        loading={users.loading}
        value={f.inspectorId}
        clearable
        onChange={(u) => set('inspector', u?.id ?? '')}
      />
      <Select label="סטטוס" value={f.status} onChange={(e) => set('status', e.target.value)}>
        <option value="">הכול</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </Select>
      <TextField label="מתאריך" type="date" value={f.from} max={f.to || undefined} onChange={(e) => set('from', e.target.value)} />
      <TextField label="עד תאריך" type="date" value={f.to} min={f.from || undefined} onChange={(e) => set('to', e.target.value)} />
    </div>
  );

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">כל הטפסים</h1>
      <MailModeBanner className="mt-4" />

      <div className="mt-5 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-5 text-muted" aria-hidden />
          <input
            type="search"
            value={f.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="אתר, מספר בדיקה או בודק"
            aria-label="חיפוש"
            className="block min-h-12 w-full rounded-ctl border border-border-strong bg-surface ps-11 pe-3.5 text-[17px] placeholder:text-muted focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none"
          />
        </div>
        <Button variant="secondary" className="min-h-12 lg:hidden" icon={<FunnelSimple className="size-5" aria-hidden />} onClick={() => setFiltersOpen(true)}>
          סינון
          {active > 0 && <span className="grid size-6 place-items-center rounded-full bg-accent text-[13px] text-accent-fg tabular-nums">{active}</span>}
        </Button>
      </div>

      <div className="mt-4 hidden rounded-box border border-border bg-surface p-4 lg:block">{filterFields}</div>

      <div className="mt-5">
        {list.error && !list.data ? (
          <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון" action={<Button onClick={list.reload}>נסה שוב</Button>}>
            {list.error}
          </EmptyState>
        ) : !list.data ? (
          <ListSkeleton rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<MagnifyingGlass />} title="לא נמצאו טפסים" className="rounded-box border border-dashed border-border">
            {active || f.q ? 'נסה לשנות את הסינון.' : 'טפסים יופיעו כאן כשבודקים יתחילו למלא.'}
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted tabular-nums" aria-live="polite">
              {rows.length} טפסים
            </p>
            <ul className={cx('flex flex-col gap-2', list.loading && 'opacity-60 transition-opacity')} data-testid="all-list">
              {rows.slice(0, limit).map((s) => {
                const logged = s.status === 'emailed' && s.mailLogged;
                // logged-only mail can go out once sending is live
                const retry = s.status === 'send_failed' || isStuck(s) || (logged && mailMode === 'live' && !s.hasChild);
                const canReopen = s.status === 'emailed' && !s.hasChild;
                const acts =
                  s.hasPdf || retry || canReopen ? (
                    <>
                      {s.hasPdf && (
                        <>
                          <a href={pdfUrl(s.id)} download className={smallBtn}>
                            <FilePdf className="size-5" aria-hidden />
                            PDF
                          </a>
                          <a href={docxUrl(s.id)} download className={smallBtn}>
                            <FileDoc className="size-5" aria-hidden />
                            Word
                          </a>
                        </>
                      )}
                      {retry && (
                        <Button variant="ghost" className="text-[15px]" loading={busy === `${s.id}:retry`} icon={<ArrowClockwise className="size-5" aria-hidden />} onClick={() => run(s, 'retry')}>
                          שליחה חוזרת
                        </Button>
                      )}
                      {canReopen && (
                        <Button variant="ghost" className="text-[15px]" icon={<ArrowsCounterClockwise className="size-5" aria-hidden />} onClick={() => setReopen(s)}>
                          פתיחה כגרסה
                        </Button>
                      )}
                    </>
                  ) : undefined;
                return (
                  <SubmissionRow key={s.id} s={s} href={rowHref(s, 'admin')} showInspector actions={acts}>
                    {s.status === 'send_failed' && s.sendError && <p className="mx-4 mb-3 line-clamp-2 text-sm text-danger">{s.sendError}</p>}
                    {logged && (
                      <div className="mx-4 mb-3">
                        <MailLoggedBadge />
                      </div>
                    )}
                  </SubmissionRow>
                );
              })}
            </ul>
            {rows.length > limit && (
              <Button variant="secondary" block className="mt-3" onClick={() => setLimit((n) => n + PAGE)}>
                טען עוד
              </Button>
            )}
          </>
        )}
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="סינון"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setParams(f.q ? { q: f.q } : {}, { replace: true })} disabled={!active}>
              ניקוי
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setFiltersOpen(false)}>
              הצגת {rows.length} טפסים
            </Button>
          </div>
        }
      >
        {filterFields}
      </Sheet>

      <Sheet
        open={reopen !== null}
        onClose={() => setReopen(null)}
        title="פתיחה כגרסה חדשה"
        footer={
          <Button variant="primary" block size="lg" loading={busy === `${reopen?.id}:reopen`} onClick={() => reopen && run(reopen, 'reopen')}>
            פתיחת גרסה {(reopen?.revision ?? 0) + 1}
          </Button>
        }
      >
        <p className="text-[15px] leading-relaxed">
          תיווצר גרסה מתוקנת של הדוח {reopen?.siteName ? `"${reopen.siteName}"` : ''} עם אותו מספר בדיקה. היא תעבור שוב אישור ותישלח כדוח חדש.
        </p>
      </Sheet>
    </section>
  );
}
