import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FileXls, ImageSquare, UploadSimple, WarningOctagon } from '@phosphor-icons/react';
import { api, ApiError } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';
import { compressImage } from '../../lib/image';
import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState, Segmented, TextArea, TextField, toast } from '../../ui';
import { RequiredFieldsCard } from './RequiredFields';
import { StandardsCard } from './Standards';
import type { RequiredOverrides } from '../../../shared/forms/required';

const TABS = [
  { value: 'company', label: 'פרטים' },
  { value: 'required', label: 'שדות חובה' },
  { value: 'standards', label: 'תקנים' },
  { value: 'export', label: 'ייצוא' },
] as const;
type TabId = (typeof TABS)[number]['value'];

type S = { recipientEmail: string; companyName: string; companyDetails: string; hasStamp: boolean; requiredOverrides?: RequiredOverrides };

export function Settings() {
  // tab in the url: back and refresh keep it
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.find((t) => t.value === params.get('tab'))?.value ?? 'company';
  const { data, error, reload } = useLoad(() => api<{ settings: S }>('/api/settings').then((r) => r.settings), 'settings');
  if (error && !data) {
    return (
      <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון את ההגדרות" action={<Button onClick={reload}>נסה שוב</Button>}>
        {error}
      </EmptyState>
    );
  }
  return (
    <section className="max-w-2xl">
      <h1 className="text-[28px] leading-tight font-bold sm:text-[32px]">הגדרות</h1>
      <Segmented label="אזור בהגדרות" className="mt-4" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={[...TABS]} />
      {!data ? (
        <div aria-busy="true" aria-label="טוען" className="mt-6 h-96 rounded-box bg-surface shadow-[var(--shadow-card)]" />
      ) : (
        <>
          {tab === 'company' && (
            <>
              <DetailsForm initial={data} />
              <StampCard hasStamp={data.hasStamp} />
            </>
          )}
          {tab === 'required' && <RequiredFieldsCard initial={data.requiredOverrides ?? {}} />}
          {tab === 'standards' && <StandardsCard />}
          {tab === 'export' && <ExportCard />}
        </>
      )}
    </section>
  );
}

function DetailsForm({ initial }: { initial: S }) {
  const [form, setForm] = useState({ recipientEmail: initial.recipientEmail, companyName: initial.companyName, companyDetails: initial.companyDetails });
  const [saved, setSaved] = useState(form);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api('/api/settings', { method: 'PUT', json: form });
      setSaved(form);
      toast.success('ההגדרות נשמרו');
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) setErr('כתובת הדוא"ל לא תקינה');
      else if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'השמירה נכשלה');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5 rounded-box bg-surface shadow-[var(--shadow-card)] p-4 md:p-6">
      <h2 className="text-lg font-semibold">שליחת דוחות</h2>
      <TextField
        label='כתובת דוא"ל לקבלת דוחות'
        hint="כל דוח שמאושר נשלח לכתובת הזו."
        type="email"
        dir="ltr"
        inputMode="email"
        autoCapitalize="none"
        error={err}
        value={form.recipientEmail}
        onChange={(e) => setForm({ ...form, recipientEmail: e.target.value.trim() })}
      />
      <h2 className="mt-2 text-lg font-semibold">פרטי החברה בדוח</h2>
      <TextField label="שם החברה" maxLength={120} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
      <TextArea
        label="פרטי החברה"
        hint="כתובת, טלפון, מספר הסמכה. מופיע בכותרת הדוח."
        maxLength={1000}
        rows={4}
        value={form.companyDetails}
        onChange={(e) => setForm({ ...form, companyDetails: e.target.value })}
      />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
          שמירת שינויים
        </Button>
      </div>
    </form>
  );
}

function StampCard({ hasStamp }: { hasStamp: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(hasStamp ? `/api/settings/stamp?v=${Date.now()}` : null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function upload(file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast.error('יש לבחור תמונה מסוג PNG, JPEG או WEBP');
      return;
    }
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      // png keeps the stamp transparent
      const small = await compressImage(file, { maxEdge: 800, png: true });
      const fd = new FormData();
      fd.set('file', small, 'stamp.png');
      await api('/api/settings/stamp', { method: 'PUT', body: fd });
      setSrc(`/api/settings/stamp?v=${Date.now()}`);
      toast.success('החותמת עודכנה');
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'ההעלאה נכשלה');
    } finally {
      setPreview(null);
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const shown = preview ?? src;
  return (
    <div className="mt-5 rounded-box bg-surface shadow-[var(--shadow-card)] p-4 md:p-6">
      <h2 className="text-lg font-semibold">חותמת החברה</h2>
      <p className="mt-1 text-[15px] text-muted">מוטבעת בסוף כל דוח, בתחתית העמוד האחרון. מומלץ PNG עם רקע שקוף.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="grid size-32 shrink-0 place-items-center overflow-hidden rounded-box border border-dashed border-border-strong bg-[#fdfdfd]">
          {shown ? (
            <img src={shown} alt="החותמת הנוכחית" className="max-h-full max-w-full object-contain p-2" onError={() => setSrc(null)} />
          ) : (
            <ImageSquare className="size-8 text-[#8a9099]" aria-hidden />
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          data-testid="stamp-input"
          onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
        />
        <Button variant="secondary" loading={busy} icon={<UploadSimple className="size-5" aria-hidden />} onClick={() => input.current?.click()}>
          {src ? 'החלפת חותמת' : 'העלאת חותמת'}
        </Button>
      </div>
    </div>
  );
}

// last month as YYYY-MM, Israel time
function lastMonth() {
  const [y, m] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }).split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function ExportCard() {
  const [month, setMonth] = useState(lastMonth);
  const ok = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  return (
    <div className="mt-5 rounded-box bg-surface shadow-[var(--shadow-card)] p-4 md:p-6">
      <h2 className="text-lg font-semibold">ייצוא חודשי</h2>
      <p className="mt-1 text-[15px] text-muted">טפסים שאושרו בחודש, לפי בודק ולפי לקוח. כל טופס נספר פעם אחת, בחודש האישור הראשון.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <TextField label="חודש" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="min-w-44 flex-1" />
        <a
          href={ok ? `/api/export?month=${month}` : undefined}
          aria-disabled={!ok}
          download
          className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-ctl bg-accent-fill px-4 font-semibold text-accent-fg transition-[transform,opacity] duration-150 ease-snap active:scale-[0.97] aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <FileXls className="size-5" aria-hidden />
          הורדת Excel
        </a>
      </div>
    </div>
  );
}
