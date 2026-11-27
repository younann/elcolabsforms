import { z } from 'zod';
import { optEmail, optText } from './users';
import { FORMS } from './forms';

const formId = z.enum(FORMS.map((f) => f.id) as [string, ...string[]]);

export const ClientInput = z.object({
  name: z.string().trim().min(1, 'שם הלקוח חובה').max(120),
  contactPerson: optText(80, 'איש קשר: עד 80 תווים'),
  phone: optText(30, 'טלפון: עד 30 תווים'),
  email: optEmail,
});
export const ClientPatch = ClientInput.partial().extend({ active: z.boolean().optional() });

export const SiteInput = z.object({
  name: z.string().trim().min(1, 'שם האתר חובה').max(120),
  address: z.string().trim().min(1, 'כתובת חובה').max(200),
  formIds: z.array(formId).transform((a) => [...new Set(a)]).optional(),
});
export const SitePatch = SiteInput.partial().extend({ active: z.boolean().optional() });

export type ClientRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  siteCount: number;
};
export type SiteRow = { id: string; clientId: string; name: string; address: string; formIds: string[]; active: boolean };
