import type { Field, Section } from './types';

export const defectsField = (): Field => ({ id: 'defects', type: 'textarea', label: 'פירוט ליקויים והערות' });

// closing sections: defects + signatures, then photos
export function closingSections(opts: { inspectorLabel: string; approverLabel: string; extra?: Field[] }): Section[] {
  return [
    {
      id: 'closing',
      title: 'ליקויים וחתימות',
      fields: [
        defectsField(),
        ...(opts.extra ?? []),
        { id: 'inspectorSignature', type: 'signature', label: opts.inspectorLabel, role: 'inspector' },
        { id: 'approverSignature', type: 'signature', label: opts.approverLabel, role: 'approver' },
      ],
    },
    { id: 'photos', title: 'תמונות', fields: [{ id: 'photos', type: 'photos', label: 'תמונות' }] },
  ];
}

export const protectedSpacesTable = (): Field => ({
  id: 'protectedSpaces',
  type: 'repeatTable',
  label: 'חללים מוגנים (פרט אזורים מוגנים ע"י המערכת)',
  columns: [
    { id: 'no', label: "מס'", type: 'text' },
    { id: 'desc', label: 'תיאור החלל המוגן', type: 'text' },
    { id: 'location', label: 'מיקום', type: 'text' },
    { id: 'risk', label: 'דרגת סיכון', type: 'text' },
    { id: 'dims', label: 'מידות החלל המוגן', type: 'text' },
    { id: 'volume', label: 'נפח מחושב (מ"ק)', type: 'number' },
    { id: 'agentWeight', label: 'משקל חומר כיבוי (גרם)', type: 'number' },
  ],
});

export const withTopic =
  (topic: string) =>
  (f: Field): Field =>
    f.type === 'check' ? { ...f, topic } : f;

export const NOTICE_TITLE = 'אישור קבלת הודעה (ציין בעל תפקיד/ שירותי כבאות)';
