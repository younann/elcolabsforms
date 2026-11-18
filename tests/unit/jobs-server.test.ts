import { describe, expect, it } from 'vitest';
import { buildJobRows } from '../../server/jobs';
import { JobCreate } from '../../shared/jobs';
import type { FormData } from '../../shared/forms/types';

const valid = {
  clientId: '11111111-1111-4111-8111-111111111111',
  siteId: '22222222-2222-4222-8222-222222222222',
  inspectorId: '33333333-3333-4333-8333-333333333333',
  plannedDate: '2026-11-24',
  forms: { gas: 1 },
};

describe('job rows', () => {
  it('builds pre-filled drafts per copy', () => {
    const rows = buildJobRows(
      { id: 'j', clientId: 'c', siteId: 's', inspectorId: 'i', plannedDate: '2026-11-24' },
      { plannedDate: '2026-11-24', siteName: 'בניין A', siteAddress: 'הרצל 12', clientName: 'מגדלי הים' },
      [{ formId: 'gas', copy: 1 }, { formId: 'gas', copy: 2 }],
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ formId: 'gas', jobId: 'j', jobCopy: 2, inspectorId: 'i', status: 'draft', siteName: 'בניין A' });
    expect((rows[0].data as FormData).customerName).toBe('מגדלי הים');
    expect(rows[0].id).not.toBe(rows[1].id);
  });
});

describe('JobCreate', () => {
  it('accepts a valid job and blanks the note', () => {
    expect(JobCreate.parse({ ...valid, note: ' ' }).note).toBeNull();
  });
  it('rejects zero, too many, or unknown forms', () => {
    expect(JobCreate.safeParse({ ...valid, forms: { gas: 0 } }).success).toBe(false);
    expect(JobCreate.safeParse({ ...valid, forms: { gas: 10 } }).success).toBe(false);
    expect(JobCreate.safeParse({ ...valid, forms: { nope: 1 } }).success).toBe(false);
    expect(JobCreate.safeParse({ ...valid, plannedDate: '24/11/2026' }).success).toBe(false);
  });
});
