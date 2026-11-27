import { describe, expect, test } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { exportSheets, type ExportRow } from '../../server/export';
import { xlsx } from '../../server/xlsx';

const row = (p: Partial<ExportRow>): ExportRow => ({
  approvedAt: new Date('2026-11-10T10:00:00Z'),
  client: 'כהן',
  site: 'מגדל',
  address: 'הרצל 1',
  inspector: 'יוסי',
  form: 'גלאים',
  testNumber: '1',
  openedBy: 'מנהל',
  ...p,
});

describe('exportSheets', () => {
  const rows = [row({}), row({ form: '1220', openedBy: 'בודק' }), row({ inspector: 'דנה', client: 'לוי' }), row({ approvedAt: new Date('2026-11-01T08:00:00Z'), testNumber: '0' })];
  const [detail, byInspector, byClient] = exportSheets(rows, ['1220', 'גלאים', 'גז']);

  test('detail has one row per form, by date', () => {
    expect(detail.rows).toHaveLength(5);
    expect(detail.rows[1][6]).toBe('0');
    expect(detail.rows[1][0]).toBe('01/11/2026');
  });
  test('detail says who opened the work', () => {
    expect(detail.rows[0][7]).toBe('נפתח ע"י');
    expect(detail.rows.slice(1).map((r) => r[7]).sort()).toEqual(['בודק', 'מנהל', 'מנהל', 'מנהל']);
  });
  test('per inspector counts form types with totals; unused types dropped', () => {
    expect(byInspector.rows[0]).toEqual(['בודק', '1220', 'גלאים', 'סה"כ']);
    expect(byInspector.rows).toContainEqual(['יוסי', 1, 2, 3]);
    expect(byInspector.rows).toContainEqual(['דנה', 0, 1, 1]);
    expect(byInspector.rows.at(-1)).toEqual(['סה"כ', 1, 3, 4]);
  });
  test('per client', () => {
    expect(byClient.rows).toContainEqual(['כהן', 1, 2, 3]);
    expect(byClient.rows).toContainEqual(['לוי', 0, 1, 1]);
  });
  test('empty month has headers and a zero total', () => {
    const [d, i] = exportSheets([], ['גז']);
    expect(d.rows).toHaveLength(1);
    expect(i.rows).toEqual([['בודק', 'סה"כ'], ['סה"כ', 0]]);
  });
});

describe('xlsx', () => {
  test('writes RTL sheets with escaped inline strings and numbers', () => {
    const files = unzipSync(xlsx([{ name: 'לפי בודק', rows: [['a<b', 'c'], ['x', 3]] }]));
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml');
    expect(strFromU8(files['xl/workbook.xml'])).toContain('name="לפי בודק"');
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('<t>a&lt;b</t>');
    expect(sheet).toContain('<c r="B2"><v>3</v></c>');
  });
});
