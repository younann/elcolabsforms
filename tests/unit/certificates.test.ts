import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { CERT_NUMBER, CertData, certTemplate, nextCertNumber } from '../../shared/certificates';
import { renderCertificateHtml } from '../../server/certificate';
import { canGetReport, engineerSees } from '../../server/submissions';
import type { Submission, User } from '../../server/db/schema';

const fx = JSON.parse(readFileSync('tests/fixtures/f1220.json', 'utf8'));

describe('nextCertNumber', () => {
  test('first of the year', () => expect(nextCertNumber('FD', 2026, [])).toBe('FD260001'));
  test('one sequence across prefixes, ignoring other years', () =>
    expect(nextCertNumber('ER', 2026, ['FD260666', 'KG260602', 'INT260649-1', 'FD250999', null])).toBe('ER260667'));
  test('number format', () => {
    expect(CERT_NUMBER.test('INT260649-1')).toBe(true);
    expect(CERT_NUMBER.test('FD26066')).toBe(false);
  });
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
  test('every form has a template', () => expect(['f1220', 'gas', 'aerosol', 'detectors', 'f536'].every((f) => certTemplate(f))).toBe(true));
});

const fixture = (id: string) => JSON.parse(readFileSync(`tests/fixtures/${id}.json`, 'utf8')).data;

describe('gas and aerosol prefill', () => {
  test('gas: spaces, contact, agent type and detector count', () => {
    const t = certTemplate('gas')!;
    const d = t.prefill(fixture('gas'));
    expect(t.prefix).toBe('KG');
    expect(d.spaces[0]).toMatchObject({ desc: 'תיאור החלל המוגן 1', volume: '2', agent: '2' });
    expect(d.dialsTo).toBe('דנה כהן, קב"ט');
    expect(d.dialsToPhone).toBe('054-3322110');
    expect(d.systemType).toBe('מכון התקנים'); // c5 gasType in the fixture
    expect(Number(d.detectorQty)).toBeGreaterThan(0);
    expect(d.contractor.idNo).toBeTruthy();
  });
  test('aerosol uses its own prefix and standard', () => {
    const t = certTemplate('aerosol')!;
    expect([t.prefix, t.standard]).toEqual(['ER', 'ת"י 5210']);
    expect(t.prefill(fixture('aerosol')).spaces.length).toBeGreaterThan(0);
  });
});

describe('detectors', () => {
  const t = certTemplate('detectors')!;
  const d = t.prefill(fixture('detectors'));
  test('prefill counts and detector row', () => {
    expect(t.prefix).toBe('FDA');
    expect(d.floors).toBe('30');
    expect(d.apartmentsWithDetectors).toBe('32');
    expect(Number(d.detectorQty)).toBeGreaterThan(0);
    expect(d.detectorRows[0]).toMatchObject({ model: 'ערך דגם 23', battery: 'ערך דגם סוללת הגלאי 26' });
  });
  test('renders conclusion on page 1 and the not-accredited note', () => {
    const html = renderCertificateHtml({ issueDate: '24/11/2026', inspectorName: 'א', engineerName: 'מ', adminName: 'ש', images: {}, template: t, number: 'FDA260549', data: d });
    expect(html.indexOf('התקנת גלאים')).toBeLessThan(html.indexOf('הערות כלליות'));
    expect(html).toContain('שלא בהסמכת הרשות');
    expect(html.match(/מסקנה:/g)).toHaveLength(1);
  });
});

describe('536 prefill', () => {
  const t = certTemplate('f536')!;
  const d = t.prefill(fixture('f536'));
  test('documents, systems and fire panel', () => {
    expect(d.docs).toHaveLength(11);
    expect(d.docs[1]).toMatchObject({ lab: 'מכון התקנים', certNo: 'IL-4424', fit: 'לא' });
    expect(d.systems.find((x) => x.name === 'מערכת BMS')?.value).toBe('כן');
    expect(d.panel[0]).toEqual({ name: 'לוח משנה', exists: 'קיים', sign: '', fit: 'מתאים' });
  });
  test('scenario tables keep only used rows and columns', () => {
    expect(d.scenarios.length).toBeGreaterThan(0);
    const s0 = d.scenarios[0];
    expect(s0.rows.every((r) => r.cells.length === s0.columns.length)).toBe(true);
    expect(s0.rows[0].action).toBe('התראה ברכזת גילוי עשן');
  });
  test('conclusion from the form', () => expect(d.fit).toBe(false));
});

describe('other layouts render', () => {
  const base = { issueDate: '24/11/2026', inspectorName: 'נאיל', engineerName: 'מקסים', adminName: 'שרה', images: {} };
  test('gas: spaces table, no ceiling note, repeat reference', () => {
    const t = certTemplate('gas')!;
    const html = renderCertificateHtml({ ...base, template: t, number: 'KG260602', data: { ...t.prefill(fixture('gas')), repeatOf: '260558' } });
    expect(html).toContain('חללים מוגנים');
    expect(html).toContain('חוזרת ל260558');
    expect(html).toContain('פריקת המחולל');
    expect(html).not.toContain('תקרה תותבת');
    expect(html).not.toContain('לוחות חשמל');
  });
  test('536: four pages with the end mark', () => {
    const t = certTemplate('f536')!;
    const html = renderCertificateHtml({ ...base, template: t, number: 'INT260649-1', data: t.prefill(fixture('f536')) });
    expect(html.match(/class="page"/g)).toHaveLength(4);
    expect(html).toContain('260649-1');
    expect(html).toContain('סוף תעודה');
    expect(html).toContain('לא מתאימה');
  });
  test('536: a page per consultant matrix scan, end mark after the last', () => {
    const t = certTemplate('f536')!;
    const html = renderCertificateHtml({ ...base, images: { matrix: ['data:image/png;base64,M1', 'data:image/png;base64,M2'] }, template: t, number: 'INT260649', data: t.prefill(fixture('f536')) });
    expect(html.match(/class="page"/g)).toHaveLength(6);
    expect(html.match(/סוף תעודה/g)).toHaveLength(1);
    expect(html.indexOf('סוף תעודה')).toBeGreaterThan(html.indexOf('M2'));
  });
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
    adminName: 'שרה',
    images: { engineerSignature: 'data:image/png;base64,AAA', adminSignature: 'data:image/png;base64,BBB', stamp: null },
  });
  test('has both pages, number, conclusion and signer', () => {
    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(html).toContain('FD260666');
    expect(html).toContain('260666');
    expect(html).toContain('אינה מתאימה');
    expect(html).toContain('מקסים');
    expect(html).toContain('data:image/png;base64,AAA');
  });
  test('admin signs the certificate', () => {
    expect(html).toContain('אישור המשרד');
    expect(html).toContain('שרה');
    expect(html).toContain('data:image/png;base64,BBB');
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
