import { describe, expect, test } from 'vitest';
import { getForm } from '../../shared/forms';
import { copyLabel, expandQuantities, isUntouched, jobState, prefillData } from '../../shared/jobs';

describe('prefillData', () => {
  test('maps present values and skips empty ones', () => {
    const f1220 = getForm('f1220');
    expect(prefillData(f1220, { plannedDate: '2026-11-24', siteName: 'בניין A', siteAddress: 'הרצל 12, חיפה', clientName: 'מגדלי הים', clientPhone: '', clientEmail: null }))
      .toEqual({ date: '2026-11-24', siteName: 'בניין A', siteAddress: 'הרצל 12, חיפה', customerName: 'מגדלי הים' });
  });
  test('treats whitespace as empty', () => {
    const out = prefillData(getForm('f1220'), { plannedDate: '2026-11-24', siteName: '  ', siteAddress: 'x', clientName: 'y' });
    expect(out).not.toHaveProperty('siteName');
  });
});

describe('jobState', () => {
  test('states', () => {
    expect(jobState([{ status: 'submitted' }, { status: 'returned' }], null)).toBe('open');
    expect(jobState([{ status: 'emailed' }], null)).toBe('done');
    expect(jobState([{ status: 'draft' }], '2026-11-17')).toBe('cancelled-open');
    expect(jobState([{ status: 'submitted' }], '2026-11-17')).toBe('cancelled');
  });
});

describe('copies', () => {
  test('copyLabel', () => {
    expect(copyLabel('גז', 2, 2)).toBe('גז 2');
    expect(copyLabel('גז', 1, 1)).toBe('גז');
  });
  test('expandQuantities', () => {
    expect(expandQuantities({ gas: 2, aerosol: 0, f536: 1 })).toEqual([{ formId: 'gas', copy: 1 }, { formId: 'gas', copy: 2 }, { formId: 'f536', copy: 1 }]);
    expect(expandQuantities({ gas: 1 }, { gas: 2 })).toEqual([{ formId: 'gas', copy: 3 }]);
  });
  test('isUntouched', () => {
    expect(isUntouched({ status: 'draft', touchedAt: null })).toBe(true);
    expect(isUntouched({ status: 'draft', touchedAt: new Date() })).toBe(false);
  });
});
