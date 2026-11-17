import { describe, expect, test } from 'vitest';
import { getForm } from '../../shared/forms';
import { markSectionNA } from '../../shared/forms/validate';
import { naLabel, sectionProgress } from '../../src/fill/progress';

const def = getForm('aerosol');

describe('sectionProgress', () => {
  test('counts required header fields', () => {
    const header = def.sections.find((s) => s.id === 'header')!;
    expect(sectionProgress(def, header, {}, [])).toEqual({ done: 0, total: 5 });
    expect(sectionProgress(def, header, { siteName: 'א', date: '2026-11-17' }, [])).toEqual({ done: 2, total: 5 });
  });

  test('marking a section NA completes its checks', () => {
    const results = def.sections.find((s) => s.id === 'results')!;
    expect(sectionProgress(def, results, {}, []).done).toBe(0);
    const data = markSectionNA(def, 'results', {});
    expect(sectionProgress(def, results, data, [])).toEqual({ done: 23, total: 23 });
  });

  test('inspector signature counts via attachment', () => {
    const closing = def.sections.find((s) => s.id === 'closing')!;
    expect(sectionProgress(def, closing, {}, [])).toEqual({ done: 0, total: 1 });
    expect(sectionProgress(def, closing, {}, [{ id: 'a', fieldId: 'inspectorSignature', kind: 'signature' }])).toEqual({
      done: 1,
      total: 1,
    });
  });

  test('NA label follows the answer set', () => {
    expect(naLabel(def.sections.find((s) => s.id === 'results')!)).toBe('סמן את השאר כ-ב"י');
    expect(naLabel(def.sections.find((s) => s.id === 'header')!)).toBeNull();
  });
});
