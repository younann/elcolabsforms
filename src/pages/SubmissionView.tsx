import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowClockwise, ArrowUUpRight, ArrowsCounterClockwise, Certificate, CheckCircle, FileDoc, FilePdf } from '@phosphor-icons/react';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { act, certPdfUrl, docxUrl, isStuck, pdfUrl } from '../lib/submissions';
import { retryCertificate } from '../lib/certificates';
import { Banner, Button, Sheet, TextArea, toast } from '../ui';
import { FormFiller } from '../fill/FormFiller';
import { MailModeBanner, useMailMode } from '../components/MailMode';
import { ReassignCard } from '../components/ReassignCard';
import { AuditButton, BackLink, DetailError, DetailSkeleton, useSubmission } from '../components/SubmissionDetail';

const POLL_MS = 4000;
// statuses after the report exists
const REPORT_READY = new Set(['emailed', 'engineer_review', 'engineer_approved', 'cert_sending', 'certified', 'cert_failed']);

const linkBtn =
  'press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-ctl border border-border-strong bg-surface px-3 text-base max-sm:flex-1 sm:px-4 font-medium whitespace-nowrap text-text transition-[transform,background-color] duration-150 ease-snap hover:bg-surface-2 active:scale-[0.97]';

/** Read-only submission with its delivery status and actions. */
export function SubmissionView() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state, load } = useSubmission(id, () => false);
  const [pending, setPending] = useState<'retry' | 'reopen' | 'engineer_approve' | 'engineer_return' | 'cert_retry' | null>(null);
  const [engSheet, setEngSheet] = useState<'approve' | 'return' | null>(null);
  const [note, setNote] = useState('');
  const [confirmReopen, setConfirmReopen] = useState(false);
  const status = state && 'submission' in state ? state.submission.status : null;
  const mailMode = useMailMode();

  // follow the report until it is sent
  useEffect(() => {
    if (status !== 'sending' && status !== 'approved' && status !== 'cert_sending') return;
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

  const engineer = user?.role === 'engineer' && s.status === 'engineer_review';

  async function engineerAct(action: 'engineer_approve' | 'engineer_return') {
    if (pending || (action === 'engineer_return' && !note.trim())) return;
    setPending(action);
    try {
      await act(s.id, action, action === 'engineer_return' ? note.trim() : undefined);
      toast.success(action === 'engineer_approve' ? 'הטופס אושר והמשרד עודכן' : 'הטופס הוחזר למשרד');
      navigate('/', { replace: true });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');
      if (e instanceof ApiError && e.status === 409) void load(true);
    } finally {
      setPending(null);
    }
  }

  async function certRetry() {
    if (pending) return;
    setPending('cert_retry');
    try {
      await retryCertificate(s.id);
      toast.success('השליחה הופעלה מחדש');
      await load(true);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');
    } finally {
      setPending(null);
    }
  }

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

  const logged = admin && s.status === 'emailed' && !!s.mailLogged;
  const canRetry = admin && (s.status === 'send_failed' || isStuck(s) || (logged && mailMode === 'live'));
  const actions = (
    <div className="flex w-full flex-wrap items-center gap-2">
      {admin && <AuditButton def={state.def} audit={state.audit} />}
      {s.pdfKey && (admin || REPORT_READY.has(s.status)) && (
        <>
          <a href={pdfUrl(s.id)} download className={linkBtn} data-testid="pdf-link">
            <FilePdf className="size-5" aria-hidden />
            PDF
          </a>
          <a href={docxUrl(s.id)} download className={linkBtn} data-testid="docx-link">
            <FileDoc className="size-5" aria-hidden />
            Word
          </a>
        </>
      )}
      {s.status === 'certified' && (
        <a href={certPdfUrl(s.id)} download className={linkBtn} data-testid="cert-link">
          <Certificate className="size-5" aria-hidden />
          תעודה
        </a>
      )}
      {engineer && (
        <>
          <Button variant="secondary" className="max-sm:flex-1" icon={<ArrowUUpRight className="size-5" aria-hidden />} onClick={() => setEngSheet('return')} disabled={pending !== null}>
            החזרה
          </Button>
          <Button variant="accent" className="max-sm:flex-1" icon={<CheckCircle className="size-5" aria-hidden />} onClick={() => setEngSheet('approve')} disabled={pending !== null}>
            אישור
          </Button>
        </>
      )}
      {admin && s.status === 'emailed' && (
        <Button variant="secondary" className="max-sm:px-3" icon={<ArrowsCounterClockwise className="size-5" aria-hidden />} onClick={() => setConfirmReopen(true)}>
          <span className="max-sm:sr-only">פתיחה כגרסה</span>
        </Button>
      )}
    </div>
  );

  return (
    <>
      <BackLink to={admin ? '/admin/submissions' : '/'} label={admin ? 'לכל הטפסים' : user?.role === 'engineer' ? 'לרשימה' : 'לטפסים שלי'} />
      <MailModeBanner />
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
      {logged && (
        <Banner tone="warning" title="מצב בדיקה – המייל לא נשלח בפועל" className="mb-5" action={canRetry ? retryBtn() : undefined}>
          הדוח הופק ונשמר, אבל המייל רק נרשם ביומן השרת.
          {mailMode === 'live' ? ' השליחה פעילה עכשיו, אפשר לשלוח שוב.' : ''}
        </Banner>
      )}
      {s.status === 'engineer_review' && !engineer && (
        <Banner tone="info" title="ממתין לאישור המהנדס" className="mb-5">
          הדוח נשלח למהנדס. כשיאשר, המשרד יקבל הודעה.
        </Banner>
      )}
      {engineer && !user?.hasSignature && (
        <Banner
          tone="warning"
          title="אין לך חתימה שמורה"
          className="mb-5"
          action={
            <Link to="/profile" className="press inline-flex min-h-11 items-center rounded-ctl bg-surface px-4 font-medium text-text ring-1 ring-border-strong active:scale-[0.97]">
              הוספת חתימה בפרופיל
            </Link>
          }
        >
          האישור חותם בחתימה השמורה שלך. יש לשמור חתימה לפני האישור.
        </Banner>
      )}
      {s.status === 'engineer_approved' && (
        <Banner
          tone="success"
          title="אושר ע״י המהנדס"
          className="mb-5"
          action={
            admin ? (
              <Link to={`/admin/certificate/${s.id}`} className="press inline-flex min-h-11 items-center gap-2 rounded-ctl bg-accent-fill px-4 font-semibold text-accent-fg active:scale-[0.97]" data-testid="issue-link">
                <Certificate className="size-5" aria-hidden />
                הפקת תעודה
              </Link>
            ) : undefined
          }
        >
          {admin ? 'אפשר להפיק את התעודה ולשלוח ללקוח.' : 'המשרד יפיק את התעודה.'}
        </Banner>
      )}
      {s.status === 'cert_sending' && (
        <Banner tone="info" title="התעודה בהכנה ובשליחה" className="mb-5" action={admin && isStuck(s) ? certRetryBtn() : undefined}>
          {isStuck(s) ? 'השליחה נתקעה. אפשר לנסות שוב.' : 'זה לוקח בדרך כלל פחות מדקה.'}
        </Banner>
      )}
      {s.status === 'cert_failed' && (
        <Banner tone="danger" title="שליחת התעודה נכשלה" className="mb-5" action={admin ? certRetryBtn() : undefined}>
          {s.sendError || 'אירעה שגיאה בהפקה או בשליחה.'}
        </Banner>
      )}
      {s.status === 'certified' && (
        <Banner tone="success" title="התעודה נשלחה ללקוח" className="mb-5" />
      )}
      {s.status === 'emailed' && !logged && (
        <Banner tone="success" title="הדוח נשלח" className="mb-5">
          {s.emailedAt ? `נשלח ב-${new Date(s.emailedAt).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' })}` : null}
        </Banner>
      )}
      {admin && (
        <ReassignCard
          submissionId={s.id}
          status={s.status}
          inspectorId={s.inspectorId}
          inspectorName={state.inspectorName}
          jobId={s.jobId}
          onDone={() => void load(true)}
        />
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
        open={engSheet === 'approve'}
        onClose={() => setEngSheet(null)}
        title="אישור מהנדס"
        footer={
          <Button variant="accent" block size="lg" loading={pending === 'engineer_approve'} disabled={!user?.hasSignature} onClick={() => engineerAct('engineer_approve')} data-testid="confirm-engineer-approve">
            אישור וחתימה
          </Button>
        }
      >
        <p className="text-[15px] leading-relaxed">האישור ייחתם בחתימה השמורה שלך, והמשרד יקבל הודעה שאפשר להפיק תעודה.</p>
      </Sheet>
      <Sheet
        open={engSheet === 'return'}
        onClose={() => setEngSheet(null)}
        title="החזרה למשרד"
        footer={
          <Button variant="primary" block size="lg" loading={pending === 'engineer_return'} disabled={!note.trim()} onClick={() => engineerAct('engineer_return')}>
            החזרה עם ההערה
          </Button>
        }
      >
        <TextArea label="מה צריך לתקן?" hint="המשרד יראה את ההערה." value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} autoFocus />
      </Sheet>
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

  function certRetryBtn() {
    return (
      <Button variant="secondary" loading={pending === 'cert_retry'} icon={<ArrowClockwise className="size-5" aria-hidden />} onClick={certRetry}>
        שליחה חוזרת
      </Button>
    );
  }

  function retryBtn() {
    return (
      <Button variant="secondary" loading={pending === 'retry'} icon={<ArrowClockwise className="size-5" aria-hidden />} onClick={() => run('retry')}>
        שליחה חוזרת
      </Button>
    );
  }
}
