export type AnswerSet = 'yesNoNA' | 'fitNotfitNA' | 'existsActive' | 'conclusion';

export const ANSWER_OPTIONS: Record<Exclude<AnswerSet, 'existsActive'>, string[]> = {
  yesNoNA: ['כן', 'לא', 'ב"י'],
  fitNotfitNA: ['מתאים', 'לא מתאים', 'ל"ר'],
  conclusion: ['מתאים', 'לא מתאים', 'ל"ר'],
};
// a no is printed as missing in reports
export const answerLabel = (a: string) => (a === 'לא' ? 'חסר' : a);
export const EXISTS_OPTIONS = ['קיים', 'לא קיים'];
export const ACTIVE_OPTIONS = ['פעיל', 'לא פעיל'];

export const NA_VALUE: Record<AnswerSet, string> = {
  yesNoNA: 'ב"י',
  fitNotfitNA: 'ל"ר',
  conclusion: 'ל"ר',
  existsActive: 'לא קיים',
};

type Base = { id: string };
export type ColumnDef = { id: string; label: string; type: 'text' | 'number' | 'choice'; options?: string[] };

export type Field =
  | (Base & { type: 'text' | 'textarea' | 'number' | 'date' | 'time'; label: string; required?: boolean })
  | (Base & { type: 'choice'; label: string; options: string[]; required?: boolean })
  | (Base & {
      type: 'check';
      clause?: string;
      topic?: string;
      text: string;
      answers: AnswerSet;
      inline?: { id: string; label: string }[];
      required?: boolean;
    })
  | (Base & { type: 'equipmentTable'; rows: string[]; required?: boolean })
  | (Base & { type: 'repeatTable'; label: string; columns: ColumnDef[]; minRows?: number; required?: boolean })
  | (Base & { type: 'systemsGrid'; systems: string[]; allowOther: boolean; required?: boolean })
  | (Base & { type: 'contactAck'; label: string; required?: boolean })
  | (Base & { type: 'signature'; label: string; role: 'inspector' | 'approver'; required?: boolean })
  | (Base & { type: 'photos'; label: string; required?: boolean })
  | (Base & { type: 'drawing'; label: string; required?: boolean })
  | (Base & {
      type: 'scenarioMatrix';
      actions: string[];
      columns: string[];
      values: string[];
      tableFields: { id: string; label: string }[];
      required?: boolean;
    })
  | (Base & { type: 'note'; text: string });

export type FieldType = Field['type'];
export type CheckField = Extract<Field, { type: 'check' }>;

export type Section = { id: string; title: string; fields: Field[] };

export type FormId = 'f1220' | 'f536' | 'detectors' | 'aerosol' | 'gas';

export type FormDef = {
  id: FormId;
  docNumber: string;
  title: string;
  shortTitle: string;
  version: number;
  sections: Section[];
};

// value shapes stored in submission.data, keyed by field id
// auto: set by a form rule, cleared when the inspector answers
export type CheckValue = { answer?: string; active?: string; note?: string; inline?: Record<string, string>; auto?: boolean };
export type EquipmentRow = { manufacturer?: string; model?: string; qty?: string };
export type ContactAckValue = { name?: string; role?: string; phone?: string; time?: string };
export type FormData = Record<string, unknown>;

// attachments are referenced by field id
export type AttachmentRef = { id: string; fieldId: string; kind: 'photo' | 'signature' | 'drawing' };

// scenarioMatrix data is ScenarioTable[] (min 1); cells[actionIdx][columnIdx] = value; actionLabels fills blank actions
export type ScenarioTable = {
  fields: Record<string, string>;
  cells: Record<number, Record<number, string>>;
  actionLabels?: Record<number, string>;
};
