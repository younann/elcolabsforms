import { z } from 'zod';
import { FORMS } from './forms';

export type AiMessage = { role: 'user' | 'model'; text: string };

const formId = z.string().refine((id) => FORMS.some((f) => f.id === id), 'טופס לא מוכר');

export const AiAsk = z.object({
  formId,
  messages: z
    .array(z.object({ role: z.enum(['user', 'model']), text: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(20)
    .refine((m) => m[m.length - 1].role === 'user', 'השאלה האחרונה חסרה'),
});

export const StandardSave = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'יש לתת שם').max(200),
  formIds: z.array(formId).max(FORMS.length),
  parts: z.number().int().min(1).max(20),
});

export const StandardPatch = z.object({ name: StandardSave.shape.name.optional(), formIds: StandardSave.shape.formIds.optional() });

export type AiResult = { status: 'pending' } | { status: 'done'; text: string; sources: { title: string; uri: string }[] } | { status: 'failed'; error: string };
