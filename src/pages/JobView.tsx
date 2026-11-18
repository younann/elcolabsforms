import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarBlank, MapPin, Phone, User, WarningOctagon } from '@phosphor-icons/react';
import { ApiError, errText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addJobForms, cancelJob, getJob, jobDate, patchJob, setJobInspector, type JobView, type Qty } from '../lib/jobs';
import { listInspectors, rowHref } from '../lib/submissions';
import { useLoad } from '../lib/useLoad';
import { Banner, Button, EmptyState, InspectorPicker, QtyStepper, Sheet, StatusBadge, TextArea, TextField, cx, toast } from '../ui';
import { ListSkeleton } from '../components/SubmissionList';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { FORMS } from '../../shared/forms';

type Panel = 'edit' | 'forms' | 'inspector' | 'cancel' | null;

const STATE_LABEL: Record<JobView['state'], string> = { open: 'פתוחה', done: 'הושלמה', cancelled: 'בוטלה', 'cancelled-open': 'בוטלה' };

export function JobPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const { data: job, error, reload } = useLoad(() => getJob(id), `job:${id}`);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);

  // one runner for every sheet action
  async function run(fn: () => Promise<JobView>, done: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      setPanel(null);
      await reload();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(errText(e));
      if (e instanceof ApiError && e.status === 409) void reload();
    } finally {
      setBusy(false);
    }
  }

  if (!job) {
    return error ? (
      <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון" action={<Button onClick={reload}>נסה שוב</Button>}>
        {error}
      </EmptyState>
    ) : (
      <ListSkeleton rows={3} />
    );
  }

  const live = !job.cancelledAt;
  return (
    <section className="max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{job.client.name}</h1>
          <p className="mt-0.5 text-[15px] text-muted">{job.site.name}</p>
        </div>
        <span
          className={cx(
            'mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold',
            job.state === 'open' ? 'bg-info-soft text-info' : job.state === 'done' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
          )}
        >
          {STATE_LABEL[job.state]}
        </span>
      </div>

      {admin && live && (
        <div className="mt-5">
          <WhatsAppButton job={job} />
        </div>
      )}

      <dl className="mt-5 grid gap-3 rounded-box border border-border bg-surface p-4 text-[15px]">
        <Line icon={<MapPin />}>{job.site.address}</Line>
        <Line icon={<CalendarBlank />}>{jobDate(job.plannedDate)}</Line>
        <Line icon={<User />}>בודק: {job.inspector.displayName}</Line>
        {(job.client.contactPerson || job.client.phone) && (
          <Line icon={<Phone />}>
            {job.client.contactPerson}{' '}
            {job.client.phone && (
              <a href={`tel:${job.client.phone}`} dir="ltr" className="font-medium text-accent underline-offset-2 hover:underline">
                {job.client.phone}
              </a>
            )}
          </Line>
        )}
        {job.note && <p className="whitespace-pre-line border-t border-border pt-3">{job.note}</p>}
      </dl>

      <h2 className="mt-7 mb-3 text-lg font-semibold">טפסים</h2>
      <ul className="flex flex-col gap-2" data-testid="job-forms">
        {job.forms.map((f) => (
          <li key={f.id}>
            <Link
              to={rowHref(f, user?.role ?? 'inspector')}
              className="press flex min-h-14 items-center gap-3 rounded-box border border-border bg-surface px-4 py-3 transition-[transform,border-color] duration-150 hover:border-border-strong active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{f.label}</span>
              <StatusBadge status={f.status} />
            </Link>
          </li>
        ))}
        {!job.forms.length && <li className="text-[15px] text-muted">אין טפסים</li>}
      </ul>

      {admin && live && (
        <div className="mt-7 grid grid-cols-2 gap-2 border-t border-border pt-5">
          <Button variant="secondary" onClick={() => setPanel('edit')}>
            תאריך והערה
          </Button>
          <Button variant="secondary" onClick={() => setPanel('forms')}>
            הוספת טפסים
          </Button>
          <Button variant="secondary" onClick={() => setPanel('inspector')}>
            החלפת בודק
          </Button>
          <Button variant="danger" onClick={() => setPanel('cancel')}>
            ביטול עבודה
          </Button>
        </div>
      )}

      {admin && (
        <>
          <EditSheet job={job} open={panel === 'edit'} busy={busy} onClose={() => setPanel(null)} onSave={(b) => run(() => patchJob(id, b), 'העבודה עודכנה')} />
          <FormsSheet open={panel === 'forms'} busy={busy} onClose={() => setPanel(null)} onSave={(q) => run(() => addJobForms(id, q), 'הטפסים נוספו')} />
          <InspectorSheet
            job={job}
            open={panel === 'inspector'}
            busy={busy}
            onClose={() => setPanel(null)}
            onSave={(pid) => run(() => setJobInspector(id, pid), 'הבודק הוחלף')}
          />
          <CancelSheet job={job} open={panel === 'cancel'} busy={busy} onClose={() => setPanel(null)} onConfirm={() => run(() => cancelJob(id), 'העבודה בוטלה')} />
        </>
      )}
    </section>
  );
}

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-muted [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

type SheetBase = { open: boolean; busy: boolean; onClose(): void };

function EditSheet({ job, open, busy, onClose, onSave }: SheetBase & { job: JobView; onSave(b: { plannedDate: string; note: string }): void }) {
  const [form, setForm] = useState({ plannedDate: job.plannedDate, note: job.note ?? '' });
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) setForm({ plannedDate: job.plannedDate, note: job.note ?? '' });
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="תאריך והערה"
      footer={
        <Button variant="primary" block size="lg" loading={busy} disabled={!form.plannedDate} onClick={() => onSave(form)}>
          שמירה
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="תאריך מתוכנן" type="date" required value={form.plannedDate} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} />
        <TextArea label="הערה לבודק" rows={3} maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <p className="text-sm text-muted">התאריך בטפסים שכבר נוצרו לא משתנה.</p>
      </div>
    </Sheet>
  );
}

function FormsSheet({ open, busy, onClose, onSave }: SheetBase & { onSave(q: Qty): void }) {
  const [qty, setQty] = useState<Qty>({});
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) setQty({});
  }
  const total = Object.values(qty).reduce((a, b) => a + b, 0);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="הוספת טפסים"
      footer={
        <Button variant="primary" block size="lg" loading={busy} disabled={!total} onClick={() => onSave(qty)}>
          {total ? `הוספת ${total} טפסים` : 'בחר טפסים'}
        </Button>
      }
    >
      <div className="divide-y divide-border">
        {FORMS.map((f) => (
          <QtyStepper key={f.id} label={f.shortTitle} value={qty[f.id] ?? 0} onChange={(n) => setQty({ ...qty, [f.id]: n })} />
        ))}
      </div>
    </Sheet>
  );
}

function InspectorSheet({ job, open, busy, onClose, onSave }: SheetBase & { job: JobView; onSave(id: string): void }) {
  const [pick, setPick] = useState('');
  const people = useLoad(() => (open ? listInspectors() : Promise.resolve(null)), open ? 'open' : 'closed');
  const moving = job.forms.filter((f) => f.status === 'draft' || f.status === 'returned').length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="החלפת בודק"
      footer={
        <Button variant="primary" block size="lg" loading={busy} disabled={!pick} onClick={() => onSave(pick)}>
          החלפה
        </Button>
      }
    >
      <p className="mb-4 text-[15px] leading-relaxed text-muted">
        {moving ? `${moving} טפסים פתוחים יעברו לבודק החדש.` : 'אין טפסים פתוחים להעברה.'} טפסים שכבר נשלחו נשארים אצל מי שמילא אותם.
      </p>
      {open && (
        <InspectorPicker
          label="בודק חדש"
          inline
          options={people.data ?? []}
          loading={people.loading}
          excludeId={job.inspector.id}
          value={pick}
          onChange={(p) => setPick(p?.id ?? '')}
        />
      )}
    </Sheet>
  );
}

function CancelSheet({ job, open, busy, onClose, onConfirm }: SheetBase & { job: JobView; onConfirm(): void }) {
  // mirrors the server: untouched drafts go, the rest stays
  const drafts = job.forms.filter((f) => f.status === 'draft').length;
  const others = job.forms.length - drafts;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ביטול עבודה"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={onClose}>
            חזרה
          </Button>
          <Button variant="danger" className="flex-1" loading={busy} onClick={onConfirm}>
            ביטול העבודה
          </Button>
        </div>
      }
    >
      <ul className="flex list-disc flex-col gap-2 ps-5 text-[15px] leading-relaxed">
        <li>טיוטות שהבודק עוד לא התחיל יימחקו{drafts ? ` (עד ${drafts})` : ''}.</li>
        <li>טיוטות שהבודק כבר עבד עליהן נשארות, והוא יכול לסיים ולשלוח אותן.</li>
        {others > 0 && <li>{others} טפסים שכבר נשלחו או הוחזרו נשארים כמו שהם.</li>}
      </ul>
      <Banner tone="warning" className="mt-4">
        אי אפשר לבטל את הביטול.
      </Banner>
    </Sheet>
  );
}
