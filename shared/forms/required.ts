import { z } from 'zod';
import type { Field, FormDef } from './types';

export type RequiredOverrides = Record<string, Record<string, boolean>>;

/** Fields the admin may switch between required and optional. */
export function isSwitchable(f: Field): boolean {
  switch (f.type) {
    case 'text':
    case 'textarea':
    case 'number':
    case 'date':
    case 'time':
    case 'choice':
    case 'check':
    case 'photos':
    case 'drawing':
    case 'repeatTable':
    case 'contactAck':
      return true;
    case 'signature':
      // approver signs after submit
      return f.role === 'inspector';
    default:
      return false;
  }
}

/** Today's behavior, before any admin choice. */
export function defaultRequired(f: Field): boolean {
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
    case 'signature':
      return f.role === 'inspector';
    case 'repeatTable':
      return (f.minRows ?? 0) > 0;
    default:
      return false;
  }
}

/** The form with `required` resolved on every field. */
export function applyRequired(def: FormDef, overrides: RequiredOverrides = {}): FormDef {
  const o = overrides[def.id] ?? {};
  return {
    ...def,
    sections: def.sections.map((s) => ({
      ...s,
      fields: s.fields.map((f) => {
        if (f.type === 'note') return f;
        const required = isSwitchable(f) ? (o[f.id] ?? defaultRequired(f)) : false;
        return { ...f, required } as Field;
      }),
    })),
  };
}

export const RequiredPut = z.object({ formId: z.string(), overrides: z.record(z.string(), z.boolean()) });
