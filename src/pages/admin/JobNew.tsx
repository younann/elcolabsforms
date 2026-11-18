import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, errText } from '../../lib/api';
import { getClient, listClients, saveSite } from '../../lib/clients';
import { createJob, type Qty } from '../../lib/jobs';
import { listInspectors } from '../../lib/submissions';
import { useLoad } from '../../lib/useLoad';
import { Banner, Button, InspectorPicker, QtyStepper, Select, TextArea, TextField, toast } from '../../ui';
import { FORMS } from '../../../shared/forms';

const NEW_SITE = '__new';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

export function JobNew() {
  const navigate = useNavigate();
  const clients = useLoad(listClients, 'clients');
  const people = useLoad(listInspectors, 'inspectors');
  const [clientId, setClientId] = useState('');
  const sites = useLoad(() => (clientId ? getClient(clientId).then((r) => r.sites.filter((s) => s.active)) : Promise.resolve([])), `sites:${clientId}`);
  const [siteId, setSiteId] = useState('');
  const [newSite, setNewSite] = useState({ name: '', address: '' });
  const [inspectorId, setInspectorId] = useState('');
  const [plannedDate, setPlannedDate] = useState(today);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState<Qty>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // site created before a failed job save is reused on retry
  const [createdSite, setCreatedSite] = useState<string | null>(null);

  // pickers match on name and contact person
  const clientOptions = (clients.data ?? []).filter((c) => c.active).map((c) => ({ id: c.id, displayName: c.name, username: c.contactPerson ?? '' }));
  const total = Object.values(qty).reduce((a, b) => a + b, 0);
  const effectiveSite = siteId || (sites.data && sites.data.length === 0 && clientId ? NEW_SITE : '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!clientId || !effectiveSite || !inspectorId || !total) {
      setErr(!clientId ? 'בחר לקוח' : !effectiveSite ? 'בחר אתר' : !inspectorId ? 'בחר בודק' : 'בחר לפחות טופס אחד');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      let site = effectiveSite;
      if (site === NEW_SITE) {
        site = createdSite ?? (await saveSite(clientId, newSite)).id;
        setCreatedSite(site);
      }
      const job = await createJob({ clientId, siteId: site, inspectorId, plannedDate, note, forms: qty });
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
      <h1 className="text-[28px] leading-tight font-bold sm:text-[32px]">עבודה חדשה</h1>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
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
            setCreatedSite(null);
          }}
        />
        {clientId && (
          <Select label="אתר" value={effectiveSite} onChange={(e) => setSiteId(e.target.value)} disabled={!sites.data}>
            <option value="" disabled>
              {sites.data ? 'בחר אתר' : 'טוען…'}
            </option>
            {sites.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.address}
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

        <fieldset>
          <legend className="text-[15px] font-medium">טפסים</legend>
          <div className="mt-1 divide-y divide-border">
            {FORMS.map((f) => (
              <QtyStepper key={f.id} label={f.shortTitle} value={qty[f.id] ?? 0} onChange={(n) => setQty({ ...qty, [f.id]: n })} />
            ))}
          </div>
        </fieldset>

        <InspectorPicker label="בודק" options={people.data ?? []} loading={people.loading} value={inspectorId} clearable onChange={(p) => setInspectorId(p?.id ?? '')} />
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
