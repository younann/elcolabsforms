import { describe, it, expect } from 'vitest';
import { FORMS, getForm } from '../../shared/forms';
import { validateForSubmit, markSectionNA } from '../../shared/forms/validate';
import type { AttachmentRef, FormDef } from '../../shared/forms/types';

const checks = (d: FormDef) => d.sections.flatMap((s) => s.fields).filter((f) => f.type === 'check');
const filled = {
  date: '2026-01-01',
  testNumber: '1',
  siteName: 'a',
  siteAddress: 'b',
  customerName: 'c',
};
const sig = (d: FormDef): AttachmentRef => {
  const f = d.sections.flatMap((s) => s.fields).find((x) => x.type === 'signature' && x.role === 'inspector')!;
  return { id: 'a1', fieldId: f.id, kind: 'signature' };
};

describe.each(FORMS.map((f) => [f.id, f] as const))('validate %s', (_i, def) => {
  it('empty data lists required fields, signature and every check', () => {
    const r = validateForSubmit(def, {}, []);
    expect(r.ok).toBe(false);
    const ids = r.missing.map((m) => m.fieldId);
    for (const id of ['date', 'testNumber', 'siteName', 'siteAddress', 'customerName']) expect(ids).toContain(id);
    expect(ids).toContain(sig(def).fieldId);
    for (const c of checks(def)) expect(ids).toContain(c.id);
  });
  it('is ok after marking all sections N/A', () => {
    let data: Record<string, unknown> = { ...filled };
    for (const s of def.sections) data = markSectionNA(def, s.id, data) as Record<string, unknown>;
    expect(validateForSubmit(def, data, [sig(def)])).toEqual({ ok: true, missing: [] });
  });
});

describe('markSectionNA', () => {
  const def = getForm('aerosol');
  const sec = def.sections.find((s) => s.fields.some((f) => f.type === 'check'))!;
  it('keeps answered checks and fills the rest', () => {
    const [a, b] = checks(def);
    const out = markSectionNA(def, sec.id, { [a.id]: { answer: 'כן' } }) as Record<string, any>;
    expect(out[a.id].answer).toBe('כן');
    expect(out[b.id].answer).toBe('ב"י');
  });
  it('does not mutate input', () => {
    const input = {};
    markSectionNA(def, sec.id, input);
    expect(input).toEqual({});
  });
  it('uses לא קיים for existsActive', () => {
    const d = getForm('f536');
    const c = d.sections.flatMap((s) => s.fields).find((f) => f.type === 'check' && f.answers === 'existsActive')!;
    const s = d.sections.find((x) => x.fields.includes(c))!;
    const out = markSectionNA(d, s.id, {}) as Record<string, any>;
    expect(out[c.id].answer).toBe('לא קיים');
  });
});
