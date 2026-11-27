import { describe, expect, it } from 'vitest';
import { FORMS, getForm } from '../../shared/forms';
import { applyRequired, isSwitchable } from '../../shared/forms/required';
import { validateForSubmit } from '../../shared/forms/validate';

const ids = (r: { missing: { fieldId: string }[] }) => r.missing.map((m) => m.fieldId);

describe('applyRequired', () => {
  it.each(FORMS.map((f) => [f.id, f] as const))('%s defaults match today', (_id, def) => {
    expect(validateForSubmit(applyRequired(def), {}, [])).toEqual(validateForSubmit(def, {}, []));
  });

  const def = getForm('aerosol');
  const check = def.sections.flatMap((s) => s.fields).find((f) => f.type === 'check')!;

  it('an optional check is not missing', () => {
    const r = validateForSubmit(applyRequired(def, { aerosol: { [check.id]: false } }), {}, []);
    expect(ids(r)).not.toContain(check.id);
  });

  it('a required text field and photos become missing', () => {
    const plain = validateForSubmit(applyRequired(def), {}, []);
    expect(ids(plain)).not.toContain('photos');
    expect(ids(plain)).not.toContain('orderNumber');
    const r = validateForSubmit(applyRequired(def, { aerosol: { photos: true, orderNumber: true } }), {}, []);
    expect(ids(r)).toContain('photos');
    expect(ids(r)).toContain('orderNumber');
    expect(validateForSubmit(applyRequired(def, { aerosol: { photos: true } }), {}, [{ id: 'p', fieldId: 'photos', kind: 'photo' }]).missing.map((m) => m.fieldId)).not.toContain('photos');
  });

  it('other forms ignore the override', () => {
    const gas = getForm('gas');
    const c = gas.sections.flatMap((s) => s.fields).find((f) => f.type === 'check')!;
    expect(ids(validateForSubmit(applyRequired(gas, { aerosol: { [c.id]: false } }), {}, []))).toContain(c.id);
  });

  it('approver signature is never switchable or required', () => {
    const f = def.sections.flatMap((s) => s.fields).find((x) => x.id === 'approverSignature')!;
    expect(isSwitchable(f)).toBe(false);
    expect(ids(validateForSubmit(applyRequired(def, { aerosol: { approverSignature: true } }), {}, []))).not.toContain('approverSignature');
  });
});
