import { z } from 'zod';
import { PASSWORD_MIN } from './password';

const PASSWORD_HINT = `סיסמה: לפחות ${PASSWORD_MIN} תווים`;
const role = z.enum(['admin', 'inspector']);
// '' clears the field
const email = z.union([z.literal(''), z.email('דוא״ל לא תקין')]).transform((v) => v || null).optional();
const phone = z.string().trim().max(30, 'טלפון: עד 30 תווים').transform((v) => v || null).optional();

export const UserCreate = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, 'שם משתמש: אותיות לועזיות, ספרות, נקודה או מקף'),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(PASSWORD_MIN, PASSWORD_HINT).max(200),
  role,
  email,
  phone,
});

export const UserPatch = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  role: role.optional(),
  active: z.boolean().optional(),
  password: z.string().min(PASSWORD_MIN, PASSWORD_HINT).max(200).optional(),
  email,
  phone,
});
