import { describe, expect, it } from 'vitest';
import { applyRules } from '../../shared/forms/rules';
import { f1220 } from '../../shared/forms/f1220';
import { gas } from '../../shared/forms/gas';
import type { CheckValue, EquipmentRow, FormData } from '../../shared/forms/types';

const NA = 'ב"י';
const R1 = 'רמת סיכון 1 – עדיפות רגילה';
const R2 = 'רמת סיכון 2 -עדיפות גבוהה';
const eqRows = f1220.sections.flatMap((s) => s.fields).find((f) => f.type === 'equipmentTable');
const rows = eqRows && eqRows.type === 'equipmentTable' ? eqRows.rows : [];
const equip = (labels: string[]): EquipmentRow[] => rows.map((r) => (labels.includes(r) ? { qty: '2' } : {}));
const change = (d: FormData, id: string, v: unknown) => applyRules(f1220, d, { ...d, [id]: v });
const ans = (d: FormData, id: string) => (d[id] as CheckValue | undefined)?.answer;

describe('f1220 N/A rules', () => {
  it('risk 1 marks risk II checks, switching to 2 swaps them', () => {
    let d = change({}, 'riskLevel', R1);
    expect([ans(d, 'c16'), ans(d, 'c118'), ans(d, 'c117')]).toEqual([NA, NA, undefined]);
    d = change(d, 'riskLevel', R2);
    expect([ans(d, 'c16'), ans(d, 'c118'), ans(d, 'c117')]).toEqual([undefined, undefined, NA]);
  });

  it('keeps answers the inspector gave', () => {
    let d: FormData = { c16: { answer: 'כן', note: 'x' } };
    d = change(d, 'riskLevel', R1);
    expect(d.c16).toEqual({ answer: 'כן', note: 'x' });
    // inspector re-answers an auto one: rule off leaves it
    d = { ...d, c118: { answer: 'לא' } };
    d = change(d, 'riskLevel', R2);
    expect(ans(d, 'c118')).toBe('לא');
    expect(ans(d, 'c16')).toBe('כן');
  });

  it('no PA and no heat detectors once the table is started', () => {
    let d = change({}, 'equipment', []);
    expect(ans(d, 'c98')).toBeUndefined();
    d = change(d, 'equipment', equip(['גלאי עשן']));
    expect(['c98', 'c99', 'c100', 'c101', 'c102', 'c77'].map((id) => ans(d, id))).toEqual(Array(6).fill(NA));
    d = change(d, 'equipment', equip(['גלאי עשן', 'מערכת כריזה']));
    expect(ans(d, 'c98')).toBeUndefined();
    expect(ans(d, 'c77')).toBe(NA);
  });

  it('leaves other forms and unrelated fields alone', () => {
    const d = { riskLevel: R1, c1: { answer: 'כן' } };
    expect(applyRules(gas, {}, d)).toBe(d);
    expect(change({}, 'riskLevel', R1).c1).toBeUndefined();
  });
});
