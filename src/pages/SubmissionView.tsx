import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowClockwise, ArrowsCounterClockwise, FilePdf } from '@phosphor-icons/react';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { act, isStuck, pdfUrl } from '../lib/submissions';
import { Banner, Button, Sheet, toast } from '../ui';
import { FormFiller } from '../fill/FormFiller';
import { DuplicateButton } from '../components/DuplicateButton';
import { AuditButton, BackLink, DetailError, DetailSkeleton, useSubmission } from '../components/SubmissionDetail';

const POLL_MS = 4000;

const linkBtn =
  'press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-ctl border border-border-strong bg-surface px-4 text-base font-medium whitespace-nowrap text-text transition-[transform,background-color] duration-150 ease-snap hover:bg-surface-2 active:scale-[0.97]';

/** Read-only submission with its delivery status and actions. */
export function SubmissionView() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state, load } = useSubmission(id, () => false);
  const [pending, setPending] = useState<'retry' | 'reopen' | null>(null);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const status = state && 'submission' in state ? state.submission.status : null;

  // follow the report until it is sent
  useEffect(() => {
    if (status !== 'sending' && status !== 'approved') return;
    const t = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(t);
  }, [status, load]);

  if (!state) return <DetailSkeleton />;
  if ('error' in state) return <DetailError error={state.error} onRetry={() => void load()} />;
  const s = state.submission;
  const admin = user?.role === 'admin';
  const owner = s.inspectorId === user?.id;
  if (admin && s.status === 'submitted') return <Navigate to={`/admin/review/${s.id}`} replace />;
  if (owner && (s.status === 'draft' || s.status === 'returned')) return <Navigate to={`/fill/${s.id}`} replace />;

  async function run(action: 'retry' | 'reopen') {
    if (pending) return;
    setPending(action);
    try {
      const r = await act(s.id, action);
      if (action === 'reopen') {
        toast.success('נפתחה גרסה חדשה לאישור');
        setConfirmReopen(false);
        navigate(`/admin/review/${r.submission.id}`);
      } else {
        toast.success('השליחה הופעלה מחדש');
        await load(true);
      }
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');
      if (e instanceof ApiError && e.status === 409) void load(true);
    } finally {
      setPending(null);
    }
  }

  const canRetry = admin && (s.status === 'send_failed' || isStuck(s));
  const actions = (
    <div className="flex shrink-0 items-center gap-2">
      {admin && <AuditButton def={state.def} audit={state.audit} />}
      {owner && <DuplicateButton id={s.id} variant="secondary" />}
      {s.pdfKey && (admin || s.status === 'emailed') && (
        <a href={pdfUrl(s.id)} download className={linkBtn} data-testid="pdf-link">
          <FilePdf className="size-5" aria-hidden />
          PDF
        </a>
      )}
      {admin && s.status === 'emailed' && (
        <Button variant="secondary" icon={<ArrowsCounterClockwise className="size-5" aria-hidden />} onClick={() => setConfirmReopen(true)}>
          <span className="max-sm:sr-only">פתיחה כגרסה</span>
        </Button>
      )}
    </div>
  );

  return (
    <>
      <BackLink to={admin ? '/admin/submissions' : '/'} label={admin ? 'לכל הטפסים' : 'לטפסים שלי'} />
      {(s.status === 'sending' || s.status === 'approved') && (
        <Banner tone="info" title="הדוח בהכנה ובשליחה" className="mb-5" action={canRetry ? retryBtn() : undefined}>
          {isStuck(s) ? 'השליחה נתקעה. אפשר לנסות שוב.' : 'זה לוקח בדרך כלל פחות מדקה. הסטטוס יתעדכן כאן.'}
        </Banner>
      )}
      {s.status === 'send_failed' && (
        <Banner tone="danger" title="שליחת הדוח נכשלה" className="mb-5" action={canRetry ? retryBtn() : undefined}>
          {s.sendError || 'אירעה שגיאה בהפקה או בשליחה.'}
          {!admin && ' מנהל יטפל בכך.'}
        </Banner>
      )}
      {s.status === 'emailed' && (
        <Banner tone="success" title="הדוח נשלח" className="mb-5">
          {s.emailedAt ? `נשלח ב-${new Date(s.emailedAt).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' })}` : null}
        </Banner>
      )}
      <FormFiller
        key={`${s.id}-${s.status}`}
        def={state.def}
        submission={s}
        initialData={state.data}
        attachments={state.attachments}
        mode={admin ? 'admin' : 'inspector'}
        readOnly
        actions={actions}
      />
      <Sheet
        open={confirmReopen}
        onClose={() => setConfirmReopen(false)}
        title="פתיחה כגרסה חדשה"
        footer={
          <Button variant="primary" block size="lg" loading={pending === 'reopen'} onClick={() => run('reopen')}>
            פתיחת גרסה {s.revision + 1}
          </Button>
        }
      >
        <p className="text-[15px] leading-relaxed">
          תיווצר גרסה מתוקנת של הדוח (Rev {s.revision + 1}) עם אותו מספר בדיקה. היא תעבור שוב אישור ותישלח כדוח חדש. הדוח שנשלח נשאר כפי שהוא.
        </p>
      </Sheet>
    </>
  );

  function retryBtn() {
    return (
      <Button variant="secondary" loading={pending === 'retry'} icon={<ArrowClockwise className="size-5" aria-hidden />} onClick={() => run('retry')}>
        שליחה חוזרת
      </Button>
    );
  }
}
