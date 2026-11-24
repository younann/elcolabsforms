import { z } from 'zod';
import { getForm } from '../forms';
import type { EquipmentRow, FormData, FormId } from '../forms/types';

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
});
export type CertData = z.infer<typeof CertData>;

export type CertTemplate = {
  prefix: string;
  title: string;
  standard: string;
  /** Short name in "תעודה לאישור מעבדה ל…". */
  systemName: string;
  prefill(d: FormData): CertData;
};

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const ymdToIl = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v);

const f1220: CertTemplate = {
  prefix: 'FD',
  title: 'תעודת בדיקה מערכות גילוי אש ת"י 1220 חלק 3',
  standard: 'ת"י 1220 חלק 3',
  systemName: 'מערכת גילוי אש',
  prefill(d) {
    const eq = Array.isArray(d.equipment) ? (d.equipment as (EquipmentRow | null)[]) : [];
    const table = getForm('f1220').sections.flatMap((x) => x.fields).find((f) => f.type === 'equipmentTable');
    const rows = table?.type === 'equipmentTable' ? table.rows : [];
    const equipment = rows.flatMap((label, i) => {
      const r = eq[i];
      if (!r || !(s(r.manufacturer) || s(r.model) || Number(r.qty) > 0)) return [];
      return [{ label, model: [s(r.manufacturer), s(r.model)].filter(Boolean).join(' '), qty: s(r.qty) }];
    });
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
      defects: s(d.defects)
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
    });
  },
};

export const CERTS: Partial<Record<FormId, CertTemplate>> = { f1220 };
export const certTemplate = (formId: string): CertTemplate | null => CERTS[formId as FormId] ?? null;

/** Next number for prefix+year, after the highest one issued; e.g. FD260667. */
export function nextCertNumber(prefix: string, year: number, existing: (string | null)[]): string {
  const head = `${prefix}${String(year % 100).padStart(2, '0')}`;
  const max = existing.reduce((m, n) => {
    if (!n?.startsWith(head)) return m;
    const k = Number(n.slice(head.length));
    return Number.isInteger(k) && k > m ? k : m;
  }, 0);
  return `${head}${String(max + 1).padStart(4, '0')}`;
}
