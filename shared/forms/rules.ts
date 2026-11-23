import type { CheckValue, EquipmentRow, FormData, FormDef, FormId } from './types';
import { NA_VALUE } from './types';

type Rule = { when: (d: FormData, def: FormDef) => boolean; checks: string[] };

const RISK_1 = 'רמת סיכון 1 – עדיפות רגילה';
const RISK_2 = 'רמת סיכון 2 -עדיפות גבוהה';

function equipment(d: FormData, def: FormDef) {
  const f = def.sections.flatMap((s) => s.fields).find((x) => x.type === 'equipmentTable');
  if (!f || f.type !== 'equipmentTable') return null;
  const rows = Array.isArray(d[f.id]) ? (d[f.id] as (EquipmentRow | null)[]) : [];
  const has = (r?: EquipmentRow | null) => !!r && (Number(r.qty) > 0 || !!r.manufacturer?.trim() || !!r.model?.trim());
  return { started: rows.some(has), has: (label: string) => has(rows[f.rows.indexOf(label)]) };
}

// a missing row means "none" only once the table is started
const lacks = (label: string) => (d: FormData, def: FormDef) => {
  const e = equipment(d, def);
  return !!e && e.started && !e.has(label);
};

const RULES: Partial<Record<FormId, Rule[]>> = {
  f1220: [
    { when: (d) => d.riskLevel === RISK_1, checks: ['c16', 'c118'] },
    { when: (d) => d.riskLevel === RISK_2, checks: ['c117'] },
    { when: lacks('מערכת כריזה'), checks: ['c98', 'c99', 'c100', 'c101', 'c102'] },
    { when: lacks('גלאי חום'), checks: ['c77'] },
  ],
};

/** Check ids an N/A rule may fill. */
export const ruleChecks = (id: FormId): Set<string> => new Set((RULES[id] ?? []).flatMap((r) => r.checks));

/** Applies N/A rules that flipped between prev and next. Manual answers are kept. */
export function applyRules(def: FormDef, prev: FormData, next: FormData): FormData {
  const rules = RULES[def.id];
  if (!rules) return next;
  let out = next;
  const checks = new Map(def.sections.flatMap((s) => s.fields).flatMap((f) => (f.type === 'check' ? [[f.id, f] as const] : [])));
  for (const r of rules) {
    const was = r.when(prev, def);
    const now = r.when(next, def);
    if (was === now) continue;
    for (const id of r.checks) {
      const f = checks.get(id);
      if (!f) continue;
      const na = NA_VALUE[f.answers];
      const cur = (out[id] ?? {}) as CheckValue;
      if (now && !cur.answer) out = { ...out, [id]: { ...cur, answer: na, auto: true } };
      else if (!now && cur.auto && cur.answer === na) out = { ...out, [id]: { ...cur, answer: undefined, auto: undefined } };
    }
  }
  return out;
}
