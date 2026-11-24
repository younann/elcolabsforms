import { z } from 'zod';
import { getForm } from '../forms';
import type { CheckValue, ContactAckValue, EquipmentRow, FormData, FormId, ScenarioTable } from '../forms/types';

const str = z.string().trim().max(2000).default('');
const party = z.object({ name: str, phone: str, idNo: str }).default({ name: '', phone: '', idNo: '' });

/** Every value printed on a certificate; the admin may edit all of it. */
export const CertData = z.object({
  testDate: str,
  siteName: str,
  buildingUse: str,
  address: str,
  agreement: str,
  description: str,
  protectedSpaces: str,
  unprotectedSpaces: str,
  fireDeptShown: str,
  fireDeptFile: str,
  fireDeptRef: str,
  gush: str,
  helka: str,
  migrash: str,
  area: str,
  height: str,
  risk: str,
  dialerPhone: str,
  dialsTo: str,
  panelType: str,
  panelLocation: str,
  equipment: z.array(z.object({ label: str, model: str, qty: str })).max(60).default([]),
  designer: party,
  contractor: party,
  escort: party,
  boards: z.array(z.object({ space: str, cutoff: str, protectedBy: str })).max(40).default([]),
  fit: z.boolean().default(true),
  defects: z.array(z.string().trim().max(1000)).max(60).default([]),
  engineerRole: z.string().trim().max(200).default('ראש תחום'),
  // gas / aerosol
  repeatOf: str,
  systemType: str,
  detectorType: str,
  detectorQty: str,
  dialsToPhone: str,
  spaces: z
    .array(z.object({ desc: str, location: str, dims: str, volume: str, agent: str, container: str, containerQty: str }))
    .max(60)
    .default([]),
  // independent detectors
  testPlace: str,
  floors: str,
  apartments: str,
  apartmentsWithDetectors: str,
  detectorLocations: str,
  detectorRows: z.array(z.object({ model: str, maker: str, location: str, battery: str })).max(30).default([]),
  // 536 integration
  customerName: str,
  clientNo: str,
  orderNo: str,
  previousCert: str,
  heightClass: str,
  docs: z.array(z.object({ type: str, lab: str, certNo: str, fit: str })).max(30).default([]),
  systems: z.array(z.object({ name: str, value: str })).max(30).default([]),
  panel: z.array(z.object({ name: str, exists: str, sign: str, fit: str })).max(30).default([]),
  scenarios: z
    .array(z.object({ location: str, detail: str, addresses: str, columns: z.array(str).max(12), rows: z.array(z.object({ action: str, cells: z.array(str).max(12) })).max(30) }))
    .max(30)
    .default([]),
});
export type CertData = z.infer<typeof CertData>;

/** detection: 1220 layout; extinguish: gas/aerosol; detectors: independent detectors; integration: 536. */
export type CertLayout = 'detection' | 'extinguish' | 'detectors' | 'integration';

export type CertTemplate = {
  layout: CertLayout;
  prefix: string;
  title: string;
  standard: string;
  /** Short name in "תעודה לאישור מעבדה ל…". */
  systemName: string;
  prefill(d: FormData): CertData;
};

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const ymdToIl = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v);

const lines = (v: unknown) =>
  s(v)
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const equipmentRows = (formId: FormId) => {
  const t = getForm(formId).sections.flatMap((x) => x.fields).find((f) => f.type === 'equipmentTable');
  return t?.type === 'equipmentTable' ? t.rows : [];
};
const filledEquipment = (formId: FormId, d: FormData) => {
  const eq = Array.isArray(d.equipment) ? (d.equipment as (EquipmentRow | null)[]) : [];
  return equipmentRows(formId).flatMap((label, i) => {
    const r = eq[i];
    if (!r || !(s(r.manufacturer) || s(r.model) || Number(r.qty) > 0)) return [];
    return [{ label, model: [s(r.manufacturer), s(r.model)].filter(Boolean).join(' '), qty: s(r.qty) }];
  });
};
const noParty = { name: '', phone: '', idNo: '' };

const f1220: CertTemplate = {
  layout: 'detection',
  prefix: 'FD',
  title: 'תעודת בדיקה מערכות גילוי אש ת"י 1220 חלק 3',
  standard: 'ת"י 1220 חלק 3',
  systemName: 'מערכת גילוי אש',
  prefill(d) {
    const equipment = filledEquipment('f1220', d);
    const panels = Array.isArray(d.panels) ? (d.panels as Record<string, unknown>[]) : [];
    const panel0 = equipment.find((e) => e.label.startsWith('רכזת'));
    return CertData.parse({
      testDate: ymdToIl(s(d.date)),
      siteName: s(d.siteName),
      buildingUse: s(d.buildingPurpose),
      address: s(d.siteAddress),
      description: s(d.buildingDescription),
      protectedSpaces: s(d.protectedSpaces),
      unprotectedSpaces: s(d.unprotectedSpaces),
      fireDeptShown: s(d.authorityRequirements),
      gush: s(d.gush),
      helka: s(d.helka),
      migrash: s(d.migrash),
      area: s(d.buildingArea),
      height: s(d.buildingHeight),
      risk: s(d.riskLevel),
      dialerPhone: s(d.dialerPhone),
      panelType: panel0?.model ?? '',
      panelLocation: s(d.panelLocation),
      equipment,
      contractor: { name: s(d.installerName), phone: s(d.installerPhone), idNo: '' },
      escort: { name: '', phone: '', idNo: '' },
      designer: { name: '', phone: '', idNo: '' },
      boards: panels
        .filter((p) => p && (s(p.detail) || s(p.location)))
        .map((p) => ({ space: [s(p.detail), s(p.location)].filter(Boolean).join(' – '), cutoff: s(p.cutoff), protectedBy: '' })),
      fit: true,
      defects: lines(d.defects),
    });
  },
};

// gas and aerosol share the layout; only the agent row and titles differ
const extinguish = (formId: 'gas' | 'aerosol', t: Omit<CertTemplate, 'layout' | 'prefill'>, agentRow: string): CertTemplate => ({
  ...t,
  layout: 'extinguish',
  prefill(d) {
    const equipment = filledEquipment(formId, d);
    const detectors = equipment.filter((e) => e.label.startsWith('גלאי'));
    const agent = equipment.find((e) => e.label === agentRow);
    const gasType = s((d.c5 as CheckValue | undefined)?.inline?.gasType);
    const ack = (d.noticeAck1 ?? {}) as ContactAckValue;
    const spaces = Array.isArray(d.protectedSpaces) ? (d.protectedSpaces as Record<string, unknown>[]) : [];
    const risks = [...new Set(spaces.map((x) => s(x?.risk)).filter(Boolean))];
    return CertData.parse({
      testDate: ymdToIl(s(d.date)),
      siteName: s(d.siteName),
      buildingUse: s(d.buildingPurpose),
      address: s(d.siteAddress),
      gush: s(d.gush),
      helka: s(d.helka),
      migrash: s(d.migrash),
      area: s(d.buildingArea),
      height: s(d.buildingHeight),
      risk: risks.join(', '),
      dialerPhone: s(d.dialerPhone),
      dialsTo: [s(ack.name), s(ack.role)].filter(Boolean).join(', '),
      dialsToPhone: s(ack.phone),
      panelType: equipment.find((e) => e.label.startsWith('רכזת'))?.model ?? '',
      systemType: (formId === 'gas' && gasType) || agent?.model || '',
      detectorType: [...new Set(detectors.map((e) => e.model).filter(Boolean))].join(', '),
      detectorQty: String(detectors.reduce((n, e) => n + (Number(e.qty) || 0), 0) || ''),
      spaces: spaces
        .filter((x) => x && (s(x.desc) || s(x.location)))
        .map((x) => ({ desc: s(x.desc), location: s(x.location), dims: s(x.dims), volume: s(x.volume), agent: s(x.agentWeight), container: agent?.model ?? '', containerQty: '' })),
      contractor: { name: s(d.installerName), phone: s(d.installerPhone), idNo: s(d.installerId) },
      designer: noParty,
      escort: noParty,
      fit: true,
      defects: lines(d.defects),
    });
  },
});

const gas = extinguish(
  'gas',
  { prefix: 'KG', title: 'תעודת בדיקת מערכת כיבוי אש בגז לדרישות ת"י 1597', standard: 'ת"י 1597', systemName: 'מערכת כיבוי אש בגז' },
  'כיבוי גז',
);
const aerosol = extinguish(
  'aerosol',
  { prefix: 'ER', title: 'תעודת בדיקת מערכת כיבוי אש באירוסול לדרישות ת"י 5210', standard: 'ת"י 5210', systemName: 'מערכת כיבוי אש באירוסול' },
  'מחולל ארוסול',
);

const detectors: CertTemplate = {
  layout: 'detectors',
  prefix: 'FDA',
  title: 'בדיקת גלאים עצמאים לנוהל כבאות סימוכין 5750-1102-2015-000467',
  standard: "הוראות נציב הכבאות, מס' הוראה 550 סעיף 3.4.8.10",
  systemName: 'מערכת גילוי אש',
  prefill(d) {
    const apts = Array.isArray(d.apartments) ? (d.apartments as Record<string, unknown>[]) : [];
    const count = apts.reduce((n, a) => n + (Number(a?.count) || 0), 0);
    const locs = [...new Set(apts.map((a) => s(a?.location)).filter(Boolean))];
    const row = { model: s(d.detectorModel), maker: s(d.detectorMaker), location: s(d.detectorLocation), battery: s(d.batteryModel) };
    return CertData.parse({
      testDate: ymdToIl(s(d.date)),
      siteName: s(d.siteName),
      buildingUse: s(d.buildingPurpose),
      address: s(d.siteAddress),
      gush: s(d.gush),
      helka: s(d.helka),
      migrash: s(d.migrash),
      floors: s(d.floors),
      detectorQty: count ? String(count) : '',
      apartments: s(d.apartmentsInBuilding),
      apartmentsWithDetectors: s(d.apartmentsWithDetectors),
      detectorLocations: locs.join(', ') || row.location,
      detectorRows: Object.values(row).some(Boolean) ? [row] : [],
      contractor: { name: s(d.installerName), phone: s(d.installerPhone), idNo: s(d.installerId) },
      designer: noParty,
      escort: noParty,
      fit: (d.conclusion as CheckValue | undefined)?.answer !== 'לא מתאים',
      defects: lines(d.defects),
    });
  },
};

const YES_NO: Record<string, string> = { מתאים: 'כן', 'לא מתאים': 'לא', 'ל"ר': 'ל.ר' };

const f536: CertTemplate = {
  layout: 'integration',
  prefix: 'INT',
  title: 'משטר הפעלות של יועץ בטיחות – רשימת תיוג לבדיקת אינטגרציה לפי הוראת מכ"ר פרק 500 הוראה 536',
  standard: 'מכ"ר 536',
  systemName: 'משטר הפעלות',
  prefill(d) {
    const fields = getForm('f536').sections.flatMap((x) => x.fields);
    const check = (id: string) => (d[id] ?? {}) as CheckValue;
    const docs = fields.flatMap((f) =>
      f.type === 'check' && /^doc\d+$/.test(f.id) ? [{ type: f.text, lab: s(check(f.id).inline?.source), certNo: s(check(f.id).inline?.docNumber), fit: YES_NO[s(check(f.id).answer)] ?? '' }] : [],
    );
    const grid = fields.find((f) => f.type === 'systemsGrid');
    const sysVals = (d.installedSystems ?? {}) as Record<string, unknown>;
    const sysNames = grid?.type === 'systemsGrid' ? [...grid.systems, ...Object.keys(sysVals).filter((k) => !grid.systems.includes(k))] : [];
    const panel = fields.flatMap((f) => {
      if (f.type !== 'check' || !/^panel\d+$/.test(f.id)) return [];
      const v = check(f.id);
      const fit = v.answer === 'לא קיים' ? 'לא רלוונטי' : v.active === 'פעיל' ? 'מתאים' : v.active === 'לא פעיל' ? 'לא מתאים' : '';
      return [{ name: f.text, exists: s(v.answer), sign: '', fit }];
    });
    const matrix = fields.find((f) => f.type === 'scenarioMatrix');
    const scenarios =
      matrix?.type === 'scenarioMatrix'
        ? ((Array.isArray(d.scenarios) ? d.scenarios : []) as ScenarioTable[]).map((t) => {
            const all = matrix.actions.map((a, ai) => ({ action: a || s(t.actionLabels?.[ai]), cells: matrix.columns.map((_, ci) => s(t.cells?.[ai]?.[ci])) }));
            const rows = all.filter((r) => r.action || r.cells.some(Boolean));
            const used = matrix.columns.map((_, ci) => rows.some((r) => r.cells[ci]));
            return {
              location: s(t.fields?.location),
              detail: s(t.fields?.detail),
              addresses: s(t.fields?.addresses),
              columns: matrix.columns.filter((_, ci) => used[ci]),
              rows: rows.map((r) => ({ action: r.action, cells: r.cells.filter((_, ci) => used[ci]) })),
            };
          })
        : [];
    return CertData.parse({
      testDate: ymdToIl(s(d.date)),
      siteName: s(d.siteName),
      buildingUse: s(d.buildingPurpose),
      address: s(d.siteAddress),
      gush: s(d.gush),
      helka: s(d.helka),
      migrash: s(d.migrash),
      customerName: s(d.customerName),
      orderNo: s(d.orderNumber),
      previousCert: s(d.previousCertNumber),
      heightClass: s(d.heightClass),
      floors: s(d.floorsDetail),
      description: s(d.inspectionType),
      designer: { name: s(d.designerName), phone: '', idNo: '' },
      docs,
      systems: sysNames.map((name) => ({ name, value: s(sysVals[name]) })).filter((x) => x.value),
      panel,
      scenarios,
      fit: check('planConclusion').answer !== 'לא מתאים',
      defects: lines(d.defects),
    });
  },
};

export const CERTS: Partial<Record<FormId, CertTemplate>> = { f1220, gas, aerosol, detectors, f536 };
export const certTemplate = (formId: string): CertTemplate | null => CERTS[formId as FormId] ?? null;

/** Certificate number: prefix, yy, 4 digits, optional -N revision. */
export const CERT_NUMBER = /^[A-Z]{1,4}\d{6}(-\d{1,2})?$/;

/** One lab-wide sequence per year across all prefixes; e.g. FD260666 then ER260667. */
export function nextCertNumber(prefix: string, year: number, existing: (string | null)[]): string {
  const yy = String(year % 100).padStart(2, '0');
  const re = new RegExp(`^[A-Z]{1,4}${yy}(\\d{4})`);
  const max = existing.reduce((m, n) => {
    const k = Number(n?.match(re)?.[1] ?? 0);
    return k > m ? k : m;
  }, 0);
  return `${prefix}${yy}${String(max + 1).padStart(4, '0')}`;
}
