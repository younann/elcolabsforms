import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Briefcase, MapPin, PencilSimple, Plus, WarningOctagon } from '@phosphor-icons/react';
import { ApiError, errText } from '../../lib/api';
import { getClient, saveClient, saveSite, type SiteRow } from '../../lib/clients';
import { useLoad } from '../../lib/useLoad';
import { Banner, Button, EmptyState, Sheet, TextField, cx, toast } from '../../ui';
import { ListSkeleton } from '../../components/SubmissionList';
import { ClientSheet } from './Clients';
import { JobGroups } from './Jobs';

export function ClientDetail() {
  const { id = '' } = useParams();
  const { data, error, reload } = useLoad(() => getClient(id), `client:${id}`);
  const [editing, setEditing] = useState(false);
  const [site, setSite] = useState<SiteRow | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    if (!data || busy) return;
    setBusy(true);
    try {
      await saveClient({ active: !data.client.active }, id);
      toast.success(data.client.active ? 'הלקוח הוסתר' : 'הלקוח מוצג שוב');
      await reload();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link to="/admin/clients" className="press -ms-2 inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-[15px] font-medium text-muted hover:bg-surface-2 hover:text-text">
      <ArrowRight className="size-5" aria-hidden />
      לקוחות
    </Link>
  );

  if (!data) {
    return (
      <section>
        {back}
        <div className="mt-4">
          {error ? (
            <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון" action={<Button onClick={reload}>נסה שוב</Button>}>
              {error}
            </EmptyState>
          ) : (
            <ListSkeleton rows={3} />
          )}
        </div>
      </section>
    );
  }

  const { client, sites } = data;
  return (
    <section>
      {back}
      <div className="mt-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className={cx('text-[28px] leading-tight font-bold sm:text-[32px]', !client.active && 'text-muted')}>{client.name}</h1>
          {!client.active && <p className="mt-1 text-sm text-muted">מוסתר. לא יופיע בבחירת לקוח לעבודה חדשה.</p>}
        </div>
        <Button variant="secondary" icon={<PencilSimple className="size-5" aria-hidden />} onClick={() => setEditing(true)}>
          עריכה
        </Button>
      </div>

      <dl className="mt-4 grid gap-2 rounded-box bg-surface shadow-[var(--shadow-card)] p-4 text-[15px]">
        <Row label="איש קשר">{client.contactPerson}</Row>
        <Row label="טלפון">
          {client.phone && (
            <a href={`tel:${client.phone}`} dir="ltr" className="font-medium text-accent underline-offset-2 hover:underline">
              {client.phone}
            </a>
          )}
        </Row>
        <Row label="דוא״ל">{client.email && <bdi>{client.email}</bdi>}</Row>
      </dl>

      <div className="mt-8 flex items-center gap-3">
        <h2 className="min-w-0 flex-1 text-lg font-semibold">אתרים</h2>
        <Button variant="secondary" icon={<Plus className="size-5" weight="bold" aria-hidden />} onClick={() => setSite('new')}>
          אתר חדש
        </Button>
      </div>
      <div className="mt-3">
        {sites.length === 0 ? (
          <EmptyState icon={<MapPin />} title="אין אתרים עדיין" />
        ) : (
          <ul className="group-list" data-testid="sites-list">
            {sites.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSite(s)}
                  className={cx(
                    'press flex min-h-14 w-full items-center gap-3 rounded-box bg-surface shadow-[var(--shadow-card)] px-4 py-3 text-start transition-[transform,border-color] duration-150 hover:border-border-strong active:scale-[0.99]',
                    !s.active && 'bg-surface-2/50',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cx('block truncate font-semibold', !s.active && 'text-muted')}>{s.name}</span>
                    <span className="block truncate text-sm text-muted">{s.address}</span>
                  </span>
                  {!s.active && <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-semibold text-muted">מוסתר</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold">עבודות</h2>
      <div className="mt-3">
        {data.jobs.length ? <JobGroups jobs={data.jobs} /> : <EmptyState icon={<Briefcase />} title="אין עבודות עדיין" />}
      </div>

      <div className="mt-8 border-t border-border pt-5">
        <Button variant={client.active ? 'danger' : 'primary'} block loading={busy} onClick={toggleActive}>
          {client.active ? 'הסתרת לקוח' : 'הצגת לקוח'}
        </Button>
        <p className="mt-2 text-sm text-muted">
          {client.active ? 'הלקוח לא יופיע בעבודות חדשות. עבודות וטפסים קיימים נשמרים.' : 'הלקוח יופיע שוב בבחירת לקוח.'}
        </p>
      </div>

      <ClientSheet
        open={editing}
        client={client}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void reload();
        }}
      />
      <SiteSheet
        clientId={id}
        site={site}
        onClose={() => setSite(null)}
        onSaved={() => {
          setSite(null);
          void reload();
        }}
      />
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">{children || <span className="text-muted">—</span>}</dd>
    </div>
  );
}

function SiteSheet({ clientId, site, onClose, onSaved }: { clientId: string; site: SiteRow | 'new' | null; onClose(): void; onSaved(): void }) {
  const [form, setForm] = useState({ name: '', address: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState<SiteRow | 'new' | null>(null);
  const existing = site && site !== 'new' ? site : undefined;

  // fill fields each time it opens
  if (site !== shown) {
    setShown(site);
    if (site) {
      setErr(null);
      setForm(existing ? { name: existing.name, address: existing.address } : { name: '', address: '' });
    }
  }

  async function save(kind: string, body: { name?: string; address?: string; active?: boolean }, done: string) {
    if (busy) return;
    setBusy(kind);
    setErr(null);
    try {
      await saveSite(clientId, body, existing?.id);
      toast.success(done);
      onSaved();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setErr(errText(e));
    } finally {
      setBusy(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save('save', form, existing ? 'האתר עודכן' : 'האתר נוסף');
  }

  return (
    <Sheet
      open={site !== null}
      onClose={onClose}
      title={existing ? 'עריכת אתר' : 'אתר חדש'}
      footer={
        <Button type="submit" form="site-form" variant="primary" block size="lg" loading={busy === 'save'}>
          {existing ? 'שמירה' : 'הוספת אתר'}
        </Button>
      }
    >
      <form id="site-form" onSubmit={submit} className="flex flex-col gap-4">
        {err && <Banner tone="danger">{err}</Banner>}
        <TextField label="שם האתר" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="כתובת" required maxLength={200} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        {existing && (
          <div className="border-t border-border pt-4">
            <Button
              variant={existing.active ? 'danger' : 'secondary'}
              block
              loading={busy === 'active'}
              onClick={() => save('active', { active: !existing.active }, existing.active ? 'האתר הוסתר' : 'האתר מוצג שוב')}
            >
              {existing.active ? 'הסתרה' : 'הצגה'}
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
