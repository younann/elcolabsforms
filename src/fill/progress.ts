import type { AttachmentRef, Field, FormData, FormDef, Section } from '../../shared/forms/types';
import { NA_VALUE } from '../../shared/forms/types';
import { validateForSubmit } from '../../shared/forms/validate';

// fields the submit check looks at
export function isTracked(f: Field): boolean {
  switch (f.type) {
    case 'text':
    case 'textarea':
    case 'number':
    case 'date':
    case 'time':
    case 'choice':
      return !!f.required;
    case 'check':
      return true;
    case 'repeatTable':
      return (f.minRows ?? 0) > 0;
    case 'signature':
      return f.role === 'inspector';
    default:
      return false;
  }
}

export function sectionProgress(def: FormDef, s: Section, data: FormData, atts: AttachmentRef[]) {
  const total = s.fields.filter(isTracked).length;
  const missing = validateForSubmit({ ...def, sections: [s] }, data, atts).missing.length;
  return { done: total - missing, total };
}

/** Bulk-NA label for a section with checks, else null. */
export function naLabel(s: Section): string | null {
  const c = s.fields.find((f) => f.type === 'check');
  return c && c.type === 'check' ? `סמן את השאר כ-${NA_VALUE[c.answers]}` : null;
}
