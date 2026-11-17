import { describe, it, expect } from 'vitest';
import { FORMS, getForm } from '../../shared/forms';
import type { Field, FormDef } from '../../shared/forms/types';

const all = (d: FormDef): Field[] => d.sections.flatMap((s) => s.fields);

describe.each(FORMS.map((f) => [f.id, f] as const))('form %s', (_id, def) => {
  it('has unique field ids', () => {
    const ids = all(def).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('starts with header section', () => {
    expect(def.sections[0].id).toBe('header');
  });
  it('has inspector and approver signatures', () => {
    const sig = all(def).filter((f) => f.type === 'signature');
    expect(sig.some((f) => f.type === 'signature' && f.role === 'inspector')).toBe(true);
    expect(sig.some((f) => f.type === 'signature' && f.role === 'approver')).toBe(true);
  });
  it('ends with photos', () => {
    const last = def.sections[def.sections.length - 1].fields;
    expect(last[last.length - 1].type).toBe('photos');
  });
  it('has non-empty check text', () => {
    for (const f of all(def)) if (f.type === 'check') expect(f.text.trim()).not.toBe('');
  });
});

describe('form specifics', () => {
  const count = (d: FormDef, t: Field['type']) => all(d).filter((f) => f.type === t).length;
  it('lists five forms and getForm works', () => {
    expect(FORMS).toHaveLength(5);
    expect(getForm('gas').id).toBe('gas');
    expect(getForm('gas', 1).version).toBe(1);
    expect(() => getForm('nope')).toThrow();
  });
  it('doc numbers', () => {
    expect(getForm('f1220').docNumber).toBe('T-20001-1');
    expect(getForm('f536').docNumber).toBe('T-20004-5');
    expect(getForm('aerosol').docNumber).toBe('');
  });
  it('f1220 has at least 125 checks', () => {
    expect(count(getForm('f1220'), 'check')).toBeGreaterThanOrEqual(125);
  });
  it('aerosol has 23 checks and 1 drawing', () => {
    expect(count(getForm('aerosol'), 'check')).toBe(23);
    expect(count(getForm('aerosol'), 'drawing')).toBe(1);
  });
  it('gas has 2 drawings', () => {
    expect(count(getForm('gas'), 'drawing')).toBe(2);
  });
  it('f536 has a scenarioMatrix', () => {
    expect(count(getForm('f536'), 'scenarioMatrix')).toBe(1);
  });
  it('detectors has the apartments table', () => {
    const t = all(getForm('detectors')).find((f) => f.type === 'repeatTable');
    expect(t && t.type === 'repeatTable' && t.columns.map((c) => c.label)).toEqual([
      'קומה',
      "מס' דירה",
      'כמות גלאים',
      'מיקום גלאים',
    ]);
  });
});
