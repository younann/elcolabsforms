import type { FormDef } from './types';
import { f1220 } from './f1220';
import { f536 } from './f536';
import { detectors } from './detectors';
import { aerosol } from './aerosol';
import { gas } from './gas';

export const FORMS: FormDef[] = [f1220, f536, detectors, aerosol, gas];

export function getForm(id: string, version?: number): FormDef {
  const f = FORMS.find((x) => x.id === id && (version === undefined || x.version === version));
  if (!f) throw new Error(`unknown form ${id}${version === undefined ? '' : ` v${version}`}`);
  return f;
}
