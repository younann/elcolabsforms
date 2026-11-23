import { describe, it, expect } from 'vitest';
import { FORMS, getForm } from '../../shared/forms';
import { validateForSubmit, markSectionNA, markSectionNACount, markSectionOKCount, hasOkChecks } from '../../shared/forms/validate';
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
  it('leaves a partly answered existsActive check alone', () => {
    const d = getForm('f536');
    const c = d.sections.flatMap((s) => s.fields).find((f) => f.type === 'check' && f.answers === 'existsActive')!;
    const s = d.sections.find((x) => x.fields.includes(c))!;
    const input = { [c.id]: { answer: 'קיים', remark: 'r' } };
    const out = markSectionNA(d, s.id, input) as Record<string, any>;
    expect(out[c.id]).toEqual({ answer: 'קיים', remark: 'r' });
    expect(validateForSubmit(d, out, []).missing.map((m) => m.fieldId)).toContain(c.id);
  });
  it('counts only the checks it changed', () => {
    const d = getForm('f536');
    const c = d.sections.flatMap((s) => s.fields).find((f) => f.type === 'check' && f.answers === 'existsActive')!;
    const s = d.sections.find((x) => x.fields.includes(c))!;
    const total = s.fields.filter((f) => f.type === 'check').length;
    expect(markSectionNACount(d, s.id, {}).changed).toBe(total);
    expect(markSectionNACount(d, s.id, { [c.id]: { answer: 'קיים' } }).changed).toBe(total - 1);
    expect(markSectionNACount(d, s.id, markSectionNA(d, s.id, {})).changed).toBe(0);
  });
});

describe('markSectionOKCount', () => {
  const find = (id: Parameters<typeof getForm>[0], pred: (f: any) => boolean) => {
    const d = getForm(id);
    const c = d.sections.flatMap((s) => s.fields).find((f) => f.type === 'check' && pred(f))!;
    return { d, c, s: d.sections.find((x) => x.fields.includes(c))! };
  };
  it('fills blank checks with the positive answer and keeps answered ones', () => {
    const def = getForm('aerosol');
    const sec = def.sections.find((s) => s.fields.some((f) => f.type === 'check'))!;
    const [a, b] = sec.fields.filter((f) => f.type === 'check');
    const r = markSectionOKCount(def, sec.id, { [a.id]: { answer: 'לא' } });
    const out = r.data as Record<string, any>;
    expect(out[a.id].answer).toBe('לא');
    expect(out[b.id].answer).toBe('כן');
    expect(r.changed).toBe(sec.fields.filter((f) => f.type === 'check').length - 1);
  });
  it('sets קיים and פעיל for existsActive', () => {
    const { d, c, s } = find('f536', (f) => f.answers === 'existsActive');
    const out = markSectionOKCount(d, s.id, {}).data as Record<string, any>;
    expect(out[c.id]).toEqual({ answer: 'קיים', active: 'פעיל' });
  });
  it('uses מתאים for fitNotfitNA', () => {
    const { d, c, s } = find('detectors', (f) => f.answers === 'fitNotfitNA');
    expect((markSectionOKCount(d, s.id, {}).data as any)[c.id].answer).toBe('מתאים');
  });
  it('skips conclusion checks', () => {
    const { d, c, s } = find('detectors', (f) => f.answers === 'conclusion');
    expect((markSectionOKCount(d, s.id, {}).data as any)[c.id]).toBeUndefined();
  });
  it('skips checks the N/A rules control and keeps auto answers', () => {
    const { d, s } = find('f1220', (f) => f.id === 'c16');
    const out = markSectionOKCount(d, s.id, { c118: { answer: 'ל"ר', auto: true } }).data as Record<string, any>;
    expect(out.c16).toBeUndefined();
    expect(out.c118).toEqual({ answer: 'ל"ר', auto: true });
  });
  it('hasOkChecks is false for a conclusion-only section', () => {
    const { d, s } = find('detectors', (f) => f.answers === 'conclusion');
    const onlyConclusion = s.fields.filter((f) => f.type === 'check').every((f) => f.type === 'check' && f.answers === 'conclusion');
    expect(hasOkChecks(d, s)).toBe(!onlyConclusion);
  });
});
