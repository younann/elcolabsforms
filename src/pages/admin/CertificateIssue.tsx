import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, PaperPlaneTilt, Plus, Trash, WarningOctagon } from '@phosphor-icons/react';
import { ApiError } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';
import { approveWithCertificate, getCertInfo, issueCertificate, previewCertificate, type CertData } from '../../lib/certificates';
import { useAuth } from '../../lib/auth';
import { CERT_NUMBER } from '../../../shared/certificates';
import { Banner, Button, EmptyState, Segmented, TextArea, TextField, toast } from '../../ui';
import { BackLink, DetailSkeleton } from '../../components/SubmissionDetail';

type Party = CertData['designer'];

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 rounded-box bg-surface p-4 shadow-[var(--shadow-card)] md:p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Admin fills the certificate on approve, then sends it after the engineer signs. */
export function CertificateIssue() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: info, error, loading, reload } = useLoad(() => getCertInfo(id), `cert:${id}`);
  const [number, setNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [d, setD] = useState<CertData | null>(null);
  const [busy, setBusy] = useState<'preview' | 'issue' | null>(null);

  useEffect(() => {
    // cached copy may predate the draft or the status: fill from fresh data only
    if (!info || loading || d) return;
    // a saved draft wins over the suggestions
    const c = info.certificate?.number ? info.certificate : null;
    setNumber(c?.number ?? info.suggestedNumber ?? '');
    setIssueDate(c?.issueDate ?? info.issueDate);
    setSentTo(c?.sentTo ?? info.recipient);
    if (info.template) setD(c ? { ...info.prefill!, ...c.data } : info.prefill);
  }, [info, loading, d]);

  if (error && !info) {
    return (
      <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון" action={<Button onClick={reload}>נסה שוב</Button>}>
        {error}
      </EmptyState>
    );
  }
  if (!info || (loading && !d)) return <DetailSkeleton />;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sentTo.trim());
  const numberOk = CERT_NUMBER.test(number.trim());
  const approving = info.status === 'submitted';
  const signed = !approving || !!user?.hasSignature;

  async function issue() {
    if (busy) return;
    setBusy('issue');
    try {
      if (approving && d) {
        await approveWithCertificate(id, { number: number.trim(), issueDate, data: d, sentTo: sentTo.trim() });
        toast.success('הטופס אושר ונשלח למהנדס');
        return navigate(`/submissions/${id}`, { replace: true });
      }
      await issueCertificate(
        id,
        info!.template && d
          ? { withoutTemplate: false, number: number.trim(), issueDate, data: d, sentTo: sentTo.trim() }
          : { withoutTemplate: true, sentTo: sentTo.trim() },
      );
      toast.success(info!.template ? 'התעודה בהכנה ותישלח ללקוח' : 'הדוח יישלח ללקוח');
      navigate(`/submissions/${id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) toast.error('חסרים שדות חובה בטופס. השלם אותם או החזר לבודק');
      else if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    if (busy || !d) return;
    setBusy('preview');
    try {
      await previewCertificate(id, { number: number.trim(), issueDate, data: d });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'התצוגה המקדימה נכשלה');
    } finally {
      setBusy(null);
    }
  }

  const recipient = (
    <TextField label="שליחה ללקוח (דוא״ל)" type="email" dir="ltr" value={sentTo} onChange={(e) => setSentTo(e.target.value)} error={sentTo && !emailOk ? 'כתובת לא תקינה' : undefined} />
  );

  if (!info.template || !d) {
    return (
      <section className="max-w-2xl">
        <BackLink to={`/submissions/${id}`} label="לטופס" />
        <h1 className="text-[28px] leading-tight font-bold">שליחה ללקוח</h1>
        <Banner tone="info" className="mt-5" title="אין עדיין תבנית תעודה לטופס זה">
          אפשר לשלוח ללקוח את הדוח המאושר במקום תעודה.
        </Banner>
        <div className="mt-5 flex flex-col gap-4 rounded-box bg-surface p-4 shadow-[var(--shadow-card)]">
          {recipient}
          <Button variant="accent" size="lg" loading={busy === 'issue'} disabled={!emailOk} icon={<PaperPlaneTilt className="size-5" aria-hidden />} onClick={issue}>
            שליחת הדוח ללקוח
          </Button>
        </div>
      </section>
    );
  }

  const layout = info.template.layout;
  const set = <K extends keyof CertData>(k: K, v: CertData[K]) => setD({ ...d, [k]: v });
  const text = (k: keyof CertData, label: string, area = false) =>
    area ? (
      <TextArea key={k} label={label} rows={2} value={String(d[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} className="sm:col-span-2" />
    ) : (
      <TextField key={k} label={label} value={String(d[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} />
    );
  const party = (k: 'designer' | 'contractor' | 'escort', title: string) => {
    const p = d[k];
    const up = (x: Partial<Party>) => set(k, { ...p, ...x });
    return (
      <div key={k} className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        <TextField label={`${title} – שם`} value={p.name} onChange={(e) => up({ name: e.target.value })} />
        <TextField label="ת.ז" value={p.idNo} onChange={(e) => up({ idNo: e.target.value })} />
        <TextField label="טלפון" dir="ltr" value={p.phone} onChange={(e) => up({ phone: e.target.value })} />
      </div>
    );
  };

  return (
    <section className="max-w-3xl pb-28">
      <BackLink to={`/submissions/${id}`} label="לטופס" />
      <h1 className="text-[28px] leading-tight font-bold">{approving ? 'אישור והפקת תעודה' : 'שליחת תעודה'}</h1>
      <p className="mt-1 text-muted">{info.template.title}</p>
      {approving && (
        <Banner tone={signed ? 'info' : 'warning'} className="mt-5" title={signed ? 'התעודה תישלח למהנדס לבדיקה וחתימה' : 'אין חתימה שמורה'}>
          {signed ? 'אחרי חתימת המהנדס היא חוזרת אליך לשליחה ללקוח. התעודה חתומה בחתימה השמורה שלך.' : 'יש לשמור חתימה בפרופיל לפני האישור.'}
        </Banner>
      )}

      <Card title="פרטי התעודה">
        <TextField label="מספר תעודה" dir="ltr" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} error={number && !numberOk ? `לדוגמה ${info.template.prefix}260001` : undefined} />
        <TextField label="תאריך הפצה" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        {recipient}
        {text('agreement', "מס' הסכם")}
        {layout === 'extinguish' && text('repeatOf', 'חוזרת לתעודה מס׳')}
      </Card>

      {layout === 'integration' ? (
        <>
          <Card title="פרטי הלקוח וההזמנה">
            {text('customerName', 'שם המזמין')}
            {text('siteName', 'שם אתר')}
            {text('address', 'כתובת אתר')}
            <TextField label="שם מתכנן" value={d.designer.name} onChange={(e) => set('designer', { ...d.designer, name: e.target.value })} />
            {text('fireDeptRef', "מס' סימוכין")}
            {text('fireDeptFile', "מס' תיק")}
            {text('clientNo', "מס' הלקוח")}
            {text('orderNo', "מס' הזמנה")}
            {text('gush', 'גוש')}
            {text('helka', 'חלקה')}
            {text('migrash', 'מגרש')}
          </Card>
          <Card title="מהות הבדיקה והאתר">
            {text('testDate', 'תאריך בדיקה')}
            {text('description', 'מבנה חדש / ביקורת תקופתית')}
            {text('previousCert', "מס' תעודה קודמת")}
            {text('heightClass', 'סיווג הבניין לפי גובה')}
            {text('floors', 'פירוט קומות')}
            {text('buildingUse', 'ייעוד המבנה')}
            {text('dialerPhone', "מס' חייגן ראשי")}
          </Card>
          <Rows
            title="רשימת מסמכים"
            rows={d.docs}
            empty={{ type: '', lab: '', certNo: '', fit: '' }}
            cols={[
              ['type', 'סוג התעודה'],
              ['lab', 'מעבדה מבצעת'],
              ['certNo', "מס' תעודה"],
              ['fit', 'מתאים (כן / לא / ל.ר)'],
            ]}
            onChange={(docs) => set('docs', docs)}
          />
          <Rows
            title="מערכות משתתפות"
            rows={d.systems}
            empty={{ name: '', value: '' }}
            cols={[
              ['name', 'מערכת'],
              ['value', 'כן / לא'],
            ]}
            onChange={(systems) => set('systems', systems)}
          />
          <Rows
            title="בעמדת כבאים מותקנים"
            rows={d.panel}
            empty={{ name: '', exists: '', sign: '', fit: '' }}
            cols={[
              ['name', 'מערכת'],
              ['exists', 'קיים / לא קיים'],
              ['sign', 'שילוט (יש / אין)'],
              ['fit', 'מתאים / לא מתאים / לא רלוונטי'],
            ]}
            onChange={(panel) => set('panel', panel)}
          />
          <Banner tone="info" className="mt-5" title="טבלאות משטר ההפעלות">
            {d.scenarios.length} טבלאות נלקחות מהטופס כפי שמילא הבודק. לשינוי – יש לתקן בטופס.
          </Banner>
        </>
      ) : layout === 'detectors' ? (
        <>
          <Card title="האתר והמבנה">
            {text('testDate', 'תאריך הבדיקה')}
            {text('siteName', 'שם האתר')}
            {text('address', 'כתובת האתר')}
            {text('buildingUse', 'ייעוד המבנה')}
            {text('testPlace', 'מקום הבדיקה')}
            {text('floors', 'מספר קומות')}
            {text('detectorQty', 'כמות הגלאים')}
            {text('apartments', "מס' דירות בבניין")}
            {text('apartmentsWithDetectors', "מס' דירות שהותקנו גלאים עצמאיים")}
            {text('detectorLocations', 'מיקום הגלאים שנבדקו')}
            {text('gush', 'גוש')}
            {text('helka', 'חלקה')}
            {text('migrash', 'מגרש')}
          </Card>
          <Rows
            title="פרטי גלאי עצמאי"
            rows={d.detectorRows}
            empty={{ model: '', maker: '', location: '', battery: '' }}
            cols={[
              ['model', 'דגם'],
              ['maker', 'מתוצרת חברת'],
              ['location', 'מיקום התקנת הגלאי'],
              ['battery', 'דגם סוללת הגלאי'],
            ]}
            onChange={(detectorRows) => set('detectorRows', detectorRows)}
          />
          <Card title="אנשים">
            {party('designer', 'מתכנן')}
            {party('contractor', 'קבלן מבצע')}
            {party('escort', 'מלווה הבדיקה')}
          </Card>
        </>
      ) : (
        <>
          <Card title="האתר והמבנה">
            {text('testDate', 'תאריך הבדיקה')}
            {text('siteName', 'שם האתר')}
            {text('address', 'כתובת האתר')}
            {text('buildingUse', 'ייעוד המבנה')}
            {layout === 'detection' && text('description', 'תיאור מבנה', true)}
            {layout === 'detection' && text('protectedSpaces', 'חללים מוגנים ע"י המערכת', true)}
            {layout === 'detection' && text('unprotectedSpaces', 'חללים אינם מוגנים', true)}
            {text('gush', 'גוש')}
            {text('helka', 'חלקה')}
            {text('migrash', 'מגרש')}
            {text('area', 'שטח המבנה (מ"ר)')}
            {text('height', 'גובה המבנה (מטר)')}
            {text('risk', 'רמת סיכון')}
          </Card>

          <Card title="כבאות ורכזת">
            {text('fireDeptShown', 'הוצגו דרישות כבאות')}
            {text('fireDeptFile', "מס' תיק")}
            {text('fireDeptRef', "מס' סימוכין")}
            {text('dialerPhone', 'הרכזת מחוברת לחייגן בטלפון')}
            {text('dialsTo', layout === 'extinguish' ? 'מחייג לאחראי בשם' : 'מחייג ל')}
            {layout === 'extinguish' && text('dialsToPhone', 'טלפון האחראי')}
            {text('panelType', 'סוג הרכזת')}
            {text('panelLocation', 'מיקום הרכזת')}
            {layout === 'extinguish' && text('systemType', 'סוג מערכת הכיבוי')}
            {layout === 'extinguish' && text('detectorType', 'סוג הגלאים')}
            {layout === 'extinguish' && text('detectorQty', 'כמות הגלאים')}
          </Card>

          {layout === 'extinguish' ? (
            <Rows
              title="חללים מוגנים"
              rows={d.spaces}
              empty={{ desc: '', location: '', dims: '', volume: '', agent: '', container: '', containerQty: '' }}
              cols={[
                ['desc', 'תיאור החלל המוגן'],
                ['location', 'מיקום'],
                ['dims', 'מידות'],
                ['volume', 'נפח החלל'],
                ['agent', 'כמות חומר הכיבוי'],
                ['container', 'סוג מיכל'],
                ['containerQty', 'כמות המכלים'],
              ]}
              onChange={(spaces) => set('spaces', spaces)}
            />
          ) : (
            <Rows
              title="ציוד"
              rows={d.equipment}
              empty={{ label: '', model: '', qty: '' }}
              cols={[
                ['label', 'פריט'],
                ['model', 'דגם'],
                ['qty', 'כמות'],
              ]}
              onChange={(equipment) => set('equipment', equipment)}
            />
          )}

          <Card title="אנשים">
            {party('designer', 'מתכנן')}
            {party('contractor', 'קבלן מבצע')}
            {party('escort', 'מלווה הבדיקה')}
          </Card>

          <Rows
            title="לוחות חשמל"
            rows={d.boards}
            empty={{ space: '', cutoff: '', protectedBy: '' }}
            cols={[
              ['space', 'תיאור החלל'],
              ['cutoff', 'ניתוק ממקור הזנה'],
              ['protectedBy', 'מוגן ע"י גלאים'],
            ]}
            onChange={(boards) => set('boards', boards)}
          />
        </>
      )}

      <section className="mt-5 flex flex-col gap-4 rounded-box bg-surface p-4 shadow-[var(--shadow-card)] md:p-6">
        <h2 className="text-lg font-semibold">מסקנה וליקויים</h2>
        <Segmented
          label="המערכת"
          value={d.fit ? 'fit' : 'unfit'}
          onChange={(v) => v && set('fit', v === 'fit')}
          options={[
            { value: 'fit', label: 'מתאימה', tone: 'success' },
            { value: 'unfit', label: 'אינה מתאימה', tone: 'danger' },
          ]}
        />
        <TextArea
          label="רשימת ליקויים"
          hint="ליקוי בכל שורה. ריק = אין."
          rows={4}
          value={d.defects.join('\n')}
          onChange={(e) => set('defects', e.target.value.split('\n'))}
        />
        <TextField label="תפקיד המאשר" value={d.engineerRole} onChange={(e) => set('engineerRole', e.target.value)} />
      </section>

      <div className="safe-x fixed inset-x-0 bottom-0 z-20 lg:start-(--nav-w) material border-t-[0.5px] border-separator pt-2.5 pb-[max(0.625rem,var(--safe-bottom))]">
        <div className="mx-auto flex max-w-3xl gap-2 px-4">
          <Button variant="secondary" className="flex-1" loading={busy === 'preview'} disabled={!numberOk} icon={<Eye className="size-5" aria-hidden />} onClick={preview}>
            תצוגה מקדימה
          </Button>
          <Button variant="accent" className="flex-1" loading={busy === 'issue'} disabled={!numberOk || !emailOk || !issueDate || !signed} icon={<PaperPlaneTilt className="size-5" aria-hidden />} onClick={issue} data-testid="issue-cert">
            {approving ? 'אישור ושליחה למהנדס' : 'שליחה ללקוח'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Rows<T extends Record<string, string>>({
  title,
  rows,
  empty,
  cols,
  onChange,
}: {
  title: string;
  rows: T[];
  empty: T;
  cols: [keyof T & string, string][];
  onChange(rows: T[]): void;
}) {
  return (
    <section className="mt-5 rounded-box bg-surface p-4 shadow-[var(--shadow-card)] md:p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">
        {rows.map((r, i) => (
          <div key={i} className="flex items-end gap-2 border-b border-border pb-4 last:border-0">
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              {cols.map(([k, label]) => (
                <TextField key={k} label={label} value={r[k]} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
              ))}
            </div>
            <Button variant="ghost" aria-label="הסרה" icon={<Trash className="size-5" aria-hidden />} onClick={() => onChange(rows.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button variant="ghost" className="self-start" icon={<Plus className="size-5" aria-hidden />} onClick={() => onChange([...rows, { ...empty }])}>
          הוספת שורה
        </Button>
      </div>
    </section>
  );
}
