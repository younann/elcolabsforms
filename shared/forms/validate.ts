import type { AttachmentRef, CheckField, CheckValue, Field, FormData, FormDef } from './types';
import { NA_VALUE } from './types';
import { ruleChecks } from './rules';
import { defaultRequired } from './required';

export type Missing = { sectionId: string; fieldId: string; label: string };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function checkAnswered(f: CheckField, v: CheckValue | undefined): boolean {
  if (!v || blank(v.answer)) return false;
  if (f.answers === 'existsActive') return v.answer === 'לא קיים' || !blank(v.active);
  return true;
}

export function labelOf(f: Field): string {
  switch (f.type) {
    case 'check':
      return f.clause ? `${f.clause} ${f.text}` : f.text;
    case 'note':
      return f.text;
    case 'equipmentTable':
      return 'אביזרי המערכת';
    case 'systemsGrid':
      return 'מערכות מחוברות';
    case 'scenarioMatrix':
      return 'משטר הפעלות';
    default:
      return f.label;
  }
}

export function validateForSubmit(
  def: FormDef,
  data: FormData,
  attachments: AttachmentRef[],
): { ok: boolean; missing: Missing[] } {
  const missing: Missing[] = [];
  for (const s of def.sections) {
    for (const f of s.fields) {
      if (f.type === 'note' || !(f.required ?? defaultRequired(f))) continue;
      let bad = false;
      const v = data[f.id];
      switch (f.type) {
        case 'text':
        case 'textarea':
        case 'number':
        case 'date':
        case 'time':
        case 'choice':
          bad = blank(v);
          break;
        case 'check':
          bad = !checkAnswered(f, v as CheckValue | undefined);
          break;
        case 'repeatTable':
          bad = Math.max(f.minRows ?? 0, 1) > (Array.isArray(v) ? v.length : 0);
          break;
        case 'signature':
          bad = !attachments.some((a) => a.fieldId === f.id && a.kind === 'signature');
          break;
        case 'photos':
          bad = !attachments.some((a) => a.fieldId === f.id && a.kind === 'photo');
          break;
        case 'drawing':
          bad = !attachments.some((a) => a.fieldId === f.id && a.kind === 'drawing');
          break;
        case 'contactAck':
          bad = blank((v as { name?: string } | undefined)?.name);
          break;
        default:
          break;
      }
      if (bad) missing.push({ sectionId: s.id, fieldId: f.id, label: labelOf(f) });
    }
  }
  return { ok: missing.length === 0, missing };
}

// any started answer is left as is
export function markSectionNACount(def: FormDef, sectionId: string, data: FormData): { data: FormData; changed: number } {
  const out: FormData = { ...data };
  let changed = 0;
  const sec = def.sections.find((s) => s.id === sectionId);
  if (!sec) return { data: out, changed };
  for (const f of sec.fields) {
    if (f.type !== 'check') continue;
    const cur = out[f.id] as CheckValue | undefined;
    if (cur && !blank(cur.answer)) continue;
    out[f.id] = { ...cur, answer: NA_VALUE[f.answers] };
    changed++;
  }
  return { data: out, changed };
}

const OK_VALUE = { yesNoNA: 'כן', fitNotfitNA: 'מתאים', existsActive: 'קיים' } as const;

// verdicts and rule-controlled checks stay manual
export function markSectionOKCount(def: FormDef, sectionId: string, data: FormData): { data: FormData; changed: number } {
  const out: FormData = { ...data };
  let changed = 0;
  const sec = def.sections.find((s) => s.id === sectionId);
  if (!sec) return { data: out, changed };
  const skip = ruleChecks(def.id);
  for (const f of sec.fields) {
    if (f.type !== 'check' || f.answers === 'conclusion' || skip.has(f.id)) continue;
    const cur = out[f.id] as CheckValue | undefined;
    if (cur && !blank(cur.answer)) continue;
    out[f.id] = f.answers === 'existsActive' ? { ...cur, answer: OK_VALUE.existsActive, active: 'פעיל' } : { ...cur, answer: OK_VALUE[f.answers] };
    changed++;
  }
  return { data: out, changed };
}

/** True when the section has a check "All OK" can fill. */
export function hasOkChecks(def: FormDef, s: { fields: Field[] }): boolean {
  const skip = ruleChecks(def.id);
  return s.fields.some((f) => f.type === 'check' && f.answers !== 'conclusion' && !skip.has(f.id));
}

export function markSectionNA(def: FormDef, sectionId: string, data: FormData): FormData {
  return markSectionNACount(def, sectionId, data).data;
}
