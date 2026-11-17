import type { AttachmentRef, CheckField, CheckValue, Field, FormData, FormDef } from './types';
import { NA_VALUE } from './types';

export type Missing = { sectionId: string; fieldId: string; label: string };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function checkAnswered(f: CheckField, v: CheckValue | undefined): boolean {
  if (!v || blank(v.answer)) return false;
  if (f.answers === 'existsActive') return v.answer === 'לא קיים' || !blank(v.active);
  return true;
}

function labelOf(f: Field): string {
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
      let bad = false;
      const v = data[f.id];
      switch (f.type) {
        case 'text':
        case 'textarea':
        case 'number':
        case 'date':
        case 'time':
        case 'choice':
          bad = !!f.required && blank(v);
          break;
        case 'check':
          bad = !checkAnswered(f, v as CheckValue | undefined);
          break;
        case 'repeatTable':
          bad = (f.minRows ?? 0) > (Array.isArray(v) ? v.length : 0);
          break;
        case 'signature':
          bad = f.role === 'inspector' && !attachments.some((a) => a.fieldId === f.id && a.kind === 'signature');
          break;
        default:
          break;
      }
      if (bad) missing.push({ sectionId: s.id, fieldId: f.id, label: labelOf(f) });
    }
  }
  return { ok: missing.length === 0, missing };
}

export function markSectionNA(def: FormDef, sectionId: string, data: FormData): FormData {
  const out: FormData = { ...data };
  const sec = def.sections.find((s) => s.id === sectionId);
  if (!sec) return out;
  for (const f of sec.fields) {
    if (f.type !== 'check') continue;
    const cur = out[f.id] as CheckValue | undefined;
    if (checkAnswered(f, cur)) continue;
    out[f.id] = { ...cur, answer: NA_VALUE[f.answers] };
  }
  return out;
}
