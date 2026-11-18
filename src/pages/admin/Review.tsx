import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowUUpRight, CheckCircle } from '@phosphor-icons/react';
import { api, ApiError } from '../../lib/api';
import { flushAll, readLocal } from '../../lib/autosave';
import { useAuth } from '../../lib/auth';
import { act } from '../../lib/submissions';
import { Banner, Button, Sheet, TextArea, toast } from '../../ui';
import { FormFiller, draftKey } from '../../fill/FormFiller';
import { MailModeBanner } from '../../components/MailMode';
import { ReassignCard } from '../../components/ReassignCard';
import { AuditButton, BackLink, DetailError, DetailSkeleton, useSubmission } from '../../components/SubmissionDetail';

// edits must reach the server before a status change
async function saved(id: string) {
  await flushAll();
  if (readLocal(draftKey(id))) {
    toast.error('השינויים עדיין לא נשמרו בשרת. בדוק את החיבור ונסה שוב');
    return false;
  }
  return true;
}

function errorText(e: unknown) {
  if (e instanceof ApiError && e.status === 422) return 'חסרים שדות חובה בטופס. השלם אותם או החזר לבודק';
  return e instanceof Error ? e.message : 'הפעולה נכשלה';
}

/** Admin review: edit, return with a note, or approve. */
export function Review() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state, load } = useSubmission(id, (s) => s.status === 'submitted');
  const [sheet, setSheet] = useState<'return' | 'approve' | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<'return' | 'approve' | null>(null);
  const [recipient, setRecipient] = useState<string | null>(null);

  useEffect(() => {
    if (sheet !== 'approve' || recipient !== null) return;
    api<{ settings: { recipientEmail?: string } }>('/api/settings')
      .then((r) => setRecipient(r.settings.recipientEmail ?? ''))
      .catch(() => {});
  }, [sheet, recipient]);

  if (!state) return <DetailSkeleton />;
  if ('error' in state) return <DetailError error={state.error} onRetry={() => void load()} />;
  const s = state.submission;
  if (s.status !== 'submitted') return <Navigate to={`/submissions/${s.id}`} replace />;

  async function doReturn() {
    if (pending || !note.trim()) return;
    setPending('return');
    try {
      if (!(await saved(id))) return;
      await act(id, 'return', note.trim());
      toast.success('הטופס הוחזר לבודק');
      navigate('/', { replace: true });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(errorText(e));
    } finally {
      setPending(null);
    }
  }

  async function doApprove() {
    if (pending) return;
    setPending('approve');
    try {
      if (!(await saved(id))) return;
      await act(id, 'approve');
      toast.success('הטופס אושר. הדוח בהכנה ובשליחה');
      navigate(`/submissions/${id}`, { replace: true });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(errorText(e));
      if (e instanceof ApiError && e.status === 409) void load(true);
    } finally {
      setPending(null);
    }
  }

  const actions = (
    <div className="flex w-full items-center gap-2">
      <AuditButton def={state.def} audit={state.audit} />
      <Button variant="secondary" className="max-sm:flex-1" icon={<ArrowUUpRight className="size-5" aria-hidden />} onClick={() => setSheet('return')} disabled={pending !== null}>
        החזרה
      </Button>
      <Button variant="accent" className="max-sm:flex-1" icon={<CheckCircle className="size-5" aria-hidden />} onClick={() => setSheet('approve')} disabled={pending !== null}>
        אישור
      </Button>
    </div>
  );

  return (
    <>
      <BackLink to="/" label="לרשימת הממתינים" />
      <MailModeBanner />
      {!user?.hasSignature && (
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
          הדוח נחתם בחתימה השמורה שלך בעת האישור. בלי חתימה תיבת המאשר תישאר ריקה.
        </Banner>
      )}
      <ReassignCard
        submissionId={s.id}
        status={s.status}
        inspectorId={s.inspectorId}
        inspectorName={state.inspectorName}
        jobId={s.jobId}
        before={() => saved(id)}
        onDone={() => void load(true)}
      />
      <FormFiller
        key={`${s.id}-${s.updatedAt}`}
        def={state.def}
        submission={s}
        initialData={state.data}
        unsaved={state.fromLocal}
        attachments={state.attachments}
        mode="admin"
        actions={actions}
      />

      <Sheet
        open={sheet === 'return'}
        onClose={() => setSheet(null)}
        title="החזרה לבודק"
        footer={
          <Button variant="primary" block size="lg" loading={pending === 'return'} disabled={!note.trim()} onClick={doReturn}>
            החזרה עם ההערה
          </Button>
        }
      >
        <TextArea
          label="מה צריך לתקן?"
          hint="הבודק יראה את ההערה בראש הטופס."
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </Sheet>

      <Sheet
        open={sheet === 'approve'}
        onClose={() => setSheet(null)}
        title="אישור ושליחת הדוח"
        footer={
          <Button variant="accent" block size="lg" loading={pending === 'approve'} onClick={doApprove} data-testid="confirm-approve">
            אישור ושליחה
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
          <p>
            הדוח יופק כ-PDF עם החתימה השמורה שלך ויישלח אל{' '}
            {recipient === null ? (
              <span className="text-muted">…</span>
            ) : recipient ? (
              <bdi className="font-semibold">{recipient}</bdi>
            ) : (
              <span className="font-semibold text-danger">כתובת שלא הוגדרה</span>
            )}
            .
          </p>
          {recipient === '' && (
            <Banner tone="danger">
              לא הוגדרה כתובת לשליחה, והשליחה תיכשל.{' '}
              <Link to="/admin/settings" className="font-semibold underline underline-offset-2">
                להגדרות
              </Link>
            </Banner>
          )}
          {!user?.hasSignature && <Banner tone="warning">אין לך חתימה שמורה. תיבת המאשר תישאר ריקה.</Banner>}
        </div>
      </Sheet>
    </>
  );
}
