import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AddressBook, CaretLeft, MagnifyingGlass, Plus, WarningOctagon } from '@phosphor-icons/react';
import { ApiError, errText } from '../../lib/api';
import { listClients, saveClient, type Client } from '../../lib/clients';
import { useLoad } from '../../lib/useLoad';
import { Banner, Button, EmptyState, Sheet, TextField, cx, toast } from '../../ui';
import { ListSkeleton } from '../../components/SubmissionList';
import { normalizeName } from '../../../shared/inspector-rank';

export function Clients() {
  const { data, error, reload } = useLoad(listClients, 'clients');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const nq = normalizeName(q);
  // shortcut: filters in the browser, move to ?q= if the list grows to thousands
  const shown = data?.filter((c) => !nq || normalizeName(`${c.name} ${c.contactPerson ?? ''}`).includes(nq));

  return (
    <section>
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-[28px] leading-tight font-bold sm:text-[32px]">לקוחות</h1>
        <Button variant="accent" icon={<Plus className="size-5" weight="bold" aria-hidden />} onClick={() => setCreating(true)}>
          לקוח חדש
        </Button>
      </div>

      {data && data.length > 0 && (
        <TextField
          label="חיפוש"
          className="mt-5"
          type="search"
          placeholder="שם לקוח או איש קשר"
          end={<MagnifyingGlass className="size-5 text-muted" aria-hidden />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      <div className="mt-5">
        {error && !data ? (
          <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון" action={<Button onClick={reload}>נסה שוב</Button>}>
            {error}
          </EmptyState>
        ) : !shown ? (
          <ListSkeleton rows={4} />
        ) : shown.length === 0 ? (
          <EmptyState icon={<AddressBook />} title={q ? 'לא נמצאו לקוחות' : 'אין לקוחות עדיין'} />
        ) : (
          <ul className="group-list" data-testid="clients-list">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/admin/clients/${c.id}`}
                  className={cx(
                    'press flex min-h-[4.25rem] w-full items-center gap-3 rounded-box bg-surface shadow-[var(--shadow-card)] px-4 py-3 transition-[transform,border-color] duration-150 ease-snap hover:border-border-strong active:scale-[0.99]',
                    !c.active && 'bg-surface-2/50',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cx('block truncate text-[17px] font-semibold', !c.active && 'text-muted')}>{c.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {[c.contactPerson, c.siteCount === 1 ? 'אתר אחד' : `${c.siteCount} אתרים`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {!c.active && <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-semibold text-muted">מוסתר</span>}
                  <CaretLeft className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ClientSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          void reload();
        }}
      />
    </section>
  );
}

const EMPTY = { name: '', contactPerson: '', phone: '', email: '' };

/** Create a client, or edit one when `client` is set. */
export function ClientSheet({ open, client, onClose, onSaved }: { open: boolean; client?: Client; onClose(): void; onSaved(c: Client): void }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // fill fields each time it opens
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setErr(null);
      setForm(client ? { name: client.name, contactPerson: client.contactPerson ?? '', phone: client.phone ?? '', email: client.email ?? '' } : EMPTY);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const c = await saveClient(form, client?.id);
      toast.success(client ? 'הלקוח עודכן' : `הלקוח ${c.name} נוצר`);
      onSaved(c);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={client ? 'עריכת לקוח' : 'לקוח חדש'}
      footer={
        <Button type="submit" form="client-form" variant="primary" block size="lg" loading={busy}>
          {client ? 'שמירה' : 'יצירת לקוח'}
        </Button>
      }
    >
      <form id="client-form" onSubmit={submit} className="flex flex-col gap-4">
        {err && <Banner tone="danger">{err}</Banner>}
        <TextField label="שם הלקוח" hint="חברה או אדם" required maxLength={120} value={form.name} onChange={set('name')} />
        <TextField label="איש קשר" maxLength={80} value={form.contactPerson} onChange={set('contactPerson')} />
        <TextField label="טלפון" type="tel" inputMode="tel" dir="ltr" maxLength={30} value={form.phone} onChange={set('phone')} />
        <TextField label="דוא״ל" type="email" dir="ltr" autoCapitalize="none" value={form.email} onChange={set('email')} />
      </form>
    </Sheet>
  );
}
