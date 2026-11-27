import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, errText } from '../../lib/api';
import { getClient, listClients, saveClient, saveSite, type SiteRow } from '../../lib/clients';
import { useAuth } from '../../lib/auth';
import { createJob } from '../../lib/jobs';
import { listInspectors } from '../../lib/submissions';
import { useLoad } from '../../lib/useLoad';
import { Banner, Button, FormChecks, InspectorPicker, Select, TextArea, TextField, toast } from '../../ui';

const NEW_SITE = '__new';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

export function JobNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  // inspectors open work for themselves
  const self = user?.role === 'inspector' ? user.id : null;
  const clients = useLoad(listClients, 'clients');
  const people = useLoad(() => (self ? Promise.resolve([]) : listInspectors()), self ? 'inspectors:off' : 'inspectors');
  const [clientId, setClientId] = useState('');
  const [newClient, setNewClient] = useState<{ name: string; contactPerson: string; phone: string } | null>(null);
  const [createdClient, setCreatedClient] = useState<string | null>(null);
  const sites = useLoad(() => (clientId ? getClient(clientId).then((r) => r.sites.filter((s) => s.active)) : Promise.resolve([])), `sites:${clientId}`);
  const [siteId, setSiteId] = useState('');
  const [newSite, setNewSite] = useState<{ name: string; address: string; formIds: string[] }>({ name: '', address: '', formIds: [] });
  // calendar passes inspector and day
  const [pickedInspector, setInspectorId] = useState(params.get('inspectorId') ?? '');
  const inspectorId = self ?? pickedInspector;
  const [plannedDate, setPlannedDate] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : today()));
  const [note, setNote] = useState('');
  const [forms, setForms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // site created before a failed job save is reused on retry
  const [createdSite, setCreatedSite] = useState<string | null>(null);

  // pickers match on name and contact person
  const clientOptions = (clients.data ?? []).filter((c) => c.active).map((c) => ({ id: c.id, displayName: c.name, username: c.contactPerson ?? '' }));
  const total = forms.length;
  const effectiveSite = newClient ? NEW_SITE : siteId || (sites.data && sites.data.length === 0 && clientId ? NEW_SITE : '');
  // a site's standard forms come pre-checked
  const pickSite = (id: string, list: SiteRow[] | null | undefined) => {
    setSiteId(id);
    const s = list?.find((x) => x.id === id);
    setForms(s ? s.formIds : []);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if ((!clientId && !newClient) || !effectiveSite || !inspectorId || !total) {
      setErr(!clientId && !newClient ? 'בחר לקוח' : !effectiveSite ? 'בחר אתר' : !inspectorId ? 'בחר בודק' : 'בחר לפחות טופס אחד');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      let client = clientId;
      if (newClient) {
        client = createdClient ?? (await saveClient(newClient)).id;
        setCreatedClient(client);
      }
      let site = effectiveSite;
      if (site === NEW_SITE) {
        site = createdSite ?? (await saveSite(client, newSite)).id;
        setCreatedSite(site);
      }
      const job = await createJob({ clientId: client, siteId: site, inspectorId, plannedDate, note, forms });
      toast.success('העבודה נוצרה');
      navigate(`/jobs/${job.id}`, { replace: true });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-xl">
      <h1 className="text-[28px] leading-tight font-bold sm:text-[32px]">{self ? 'פתיחת עבודה' : 'עבודה חדשה'}</h1>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
        {newClient ? (
          <div className="flex flex-col gap-4 rounded-box bg-surface shadow-[var(--shadow-card)] p-4">
            <TextField label="שם הלקוח" required maxLength={120} value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
            <TextField label="איש קשר" maxLength={80} value={newClient.contactPerson} onChange={(e) => setNewClient({ ...newClient, contactPerson: e.target.value })} />
            <TextField label="טלפון" type="tel" maxLength={30} value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
            <Button variant="secondary" disabled={!!createdClient} onClick={() => setNewClient(null)}>
              בחירת לקוח קיים
            </Button>
          </div>
        ) : (
        <InspectorPicker
          label="לקוח"
          noun={{ one: 'לקוח', many: 'לקוחות' }}
          options={clientOptions}
          loading={clients.loading}
          value={clientId}
          clearable
          onChange={(c) => {
            setClientId(c?.id ?? '');
            setSiteId('');
            setForms([]);
            setCreatedSite(null);
          }}
        />
        )}
        {!newClient && !clientId && (
          <Button variant="secondary" onClick={() => setNewClient({ name: '', contactPerson: '', phone: '' })}>
            + לקוח חדש
          </Button>
        )}
        {clientId && !newClient && (
          <Select label="אתר" value={effectiveSite} onChange={(e) => pickSite(e.target.value, sites.data)} disabled={!sites.data}>
            <option value="" disabled>
              {sites.data ? 'בחר אתר' : 'טוען…'}
            </option>
            {sites.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.address ? `${s.name} · ${s.address}` : s.name}
              </option>
            ))}
            <option value={NEW_SITE}>+ אתר חדש</option>
          </Select>
        )}
        {effectiveSite === NEW_SITE && (
          <div className="flex flex-col gap-4 rounded-box bg-surface shadow-[var(--shadow-card)] p-4">
            <TextField label="שם האתר" required maxLength={120} value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} />
            <TextField label="כתובת" required maxLength={200} value={newSite.address} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} />
          </div>
        )}

        <FormChecks
          value={forms}
          onChange={(f) => {
            setForms(f);
            // a new site keeps the chosen forms as its standard set
            if (effectiveSite === NEW_SITE) setNewSite({ ...newSite, formIds: f });
          }}
        />

        {!self && (
          <InspectorPicker label="בודק" options={people.data ?? []} loading={people.loading} value={inspectorId} clearable onChange={(p) => setInspectorId(p?.id ?? '')} />
        )}
        <TextField label="תאריך מתוכנן" type="date" required value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        <TextArea label="הערה לבודק" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />

        {err && <Banner tone="danger">{err}</Banner>}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          {total ? `יצירת עבודה (${total} טפסים)` : 'יצירת עבודה'}
        </Button>
      </form>
    </section>
  );
}
