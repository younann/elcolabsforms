import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { CertData, certTemplate, nextCertNumber } from '../../shared/certificates';
import { renderCertificateHtml } from '../../server/certificate';
import { canGetReport, engineerSees } from '../../server/submissions';
import type { Submission, User } from '../../server/db/schema';

const fx = JSON.parse(readFileSync('tests/fixtures/f1220.json', 'utf8'));

describe('nextCertNumber', () => {
  test('first of the year', () => expect(nextCertNumber('FD', 2026, [])).toBe('FD260001'));
  test('after the highest, ignoring other prefixes, years and gaps', () =>
    expect(nextCertNumber('FD', 2026, ['FD260666', 'FD260012', 'FD250999', 'GS260900', null])).toBe('FD260667'));
  test('new year starts again', () => expect(nextCertNumber('FD', 2027, ['FD260666'])).toBe('FD270001'));
});

describe('1220 prefill', () => {
  const t = certTemplate('f1220')!;
  const d = t.prefill(fx.data);
  test('maps site and building fields', () => {
    expect(d.testDate).toBe('12/11/2026');
    expect(d.siteName).toBe(fx.data.siteName);
    expect(d.buildingUse).toBe('מגורים ומסחר');
    expect(d.risk).toBe(fx.data.riskLevel);
  });
  test('keeps only filled equipment rows with model and qty', () => {
    expect(d.equipment[0]).toEqual({ label: 'רכזת אנלוגית / אזורית', model: 'Apollo XP95-0', qty: '1' });
    expect(d.equipment.every((e) => e.model || e.qty)).toBe(true);
    expect(d.panelType).toBe('Apollo XP95-0');
  });
  test('boards and defects', () => {
    expect(d.boards[0]).toEqual({ space: 'פירוט לוח חשמל 1 – מיקום לוח חשמל 1', cutoff: 'כן', protectedBy: '' });
    expect(d.defects).toHaveLength(2);
  });
  test('no template for other forms yet', () => expect(certTemplate('gas')).toBeNull());
});

describe('renderCertificateHtml', () => {
  const t = certTemplate('f1220')!;
  const html = renderCertificateHtml({
    template: t,
    number: 'FD260666',
    issueDate: '18/11/2026',
    data: { ...t.prefill(fx.data), siteName: '<b>x</b>', fit: false },
    inspectorName: 'נאיל',
    engineerName: 'מקסים',
    images: { engineerSignature: 'data:image/png;base64,AAA', stamp: null },
  });
  test('has both pages, number, conclusion and signer', () => {
    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(html).toContain('FD260666');
    expect(html).toContain('260666');
    expect(html).toContain('אינה מתאימה');
    expect(html).toContain('מקסים');
    expect(html).toContain('data:image/png;base64,AAA');
  });
  test('escapes form text', () => {
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
  test('defaults fill a sparse payload', () => expect(CertData.parse({}).engineerRole).toBe('ראש תחום'));
});

describe('engineer access', () => {
  const eng = { id: 'e1', role: 'engineer' } as User;
  const insp = { id: 'i1', role: 'inspector' } as User;
  const sub = (p: Partial<Submission>) => ({ inspectorId: 'i1', needsEngineer: true, status: 'engineer_review', engineerId: null, ...p }) as Submission;
  test('sees waiting forms and ones they approved only', () => {
    expect(engineerSees(eng, sub({}))).toBe(true);
    expect(engineerSees(eng, sub({ status: 'certified', engineerId: 'e1' }))).toBe(true);
    expect(engineerSees(eng, sub({ status: 'certified', engineerId: 'e2' }))).toBe(false);
    expect(engineerSees(eng, sub({ status: 'submitted' }))).toBe(false);
    expect(engineerSees(eng, sub({ needsEngineer: false }))).toBe(false);
  });
  test('inspector gets the report once approved by the office', () => {
    expect(canGetReport(insp, sub({ status: 'submitted' }))).toBe(false);
    expect(canGetReport(insp, sub({ status: 'engineer_review' }))).toBe(true);
    expect(canGetReport(insp, sub({ status: 'emailed' }))).toBe(true);
  });
});
