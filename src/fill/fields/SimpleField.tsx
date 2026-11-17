import { memo } from 'react';
import { Info } from '@phosphor-icons/react';
import { Segmented, TextField } from '../../ui';
import type { Field } from '../../../shared/forms/types';
import { fieldDomId } from '../context';
import { Label, Select, TextArea, str, type FieldProps } from './inputs';

type Simple = Extract<Field, { type: 'text' | 'textarea' | 'number' | 'date' | 'time' }>;

const reqMark = (label: string, required?: boolean) =>
  required ? (
    <>
      {label}
      <span className="ms-1 text-accent" aria-hidden>
        *
      </span>
    </>
  ) : (
    label
  );

export const SimpleField = memo(function SimpleField({ field: f, value, onChange, disabled }: FieldProps<Simple>) {
  const v = str(value);
  if (f.type === 'textarea') {
    return (
      <TextArea
        id={fieldDomId(f.id)}
        label={f.label}
        required={f.required}
        value={v}
        disabled={disabled}
        onChange={(e) => onChange(f.id, e.target.value)}
      />
    );
  }
  const extra =
    f.type === 'number'
      ? { type: 'text', inputMode: 'decimal' as const, dir: 'ltr', className: '[&_input]:text-end' }
      : f.type === 'date' || f.type === 'time'
        ? { type: f.type }
        : { type: 'text', enterKeyHint: 'next' as const };
  return (
    <TextField
      id={fieldDomId(f.id)}
      label={reqMark(f.label, f.required)}
      value={v}
      disabled={disabled}
      required={f.required}
      onChange={(e) => onChange(f.id, e.target.value)}
      {...extra}
    />
  );
});

type Choice = Extract<Field, { type: 'choice' }>;

export const ChoiceField = memo(function ChoiceField({ field: f, value, onChange, disabled }: FieldProps<Choice>) {
  const v = str(value);
  // short option lists as segments
  const segmented = f.options.length <= 3 && f.options.every((o) => o.length <= 14);
  return (
    <div className="flex flex-col gap-1.5" id={segmented ? fieldDomId(f.id) : undefined} tabIndex={segmented ? -1 : undefined}>
      <Label htmlFor={segmented ? undefined : fieldDomId(f.id)} required={f.required}>
        {f.label}
      </Label>
      {segmented ? (
        <Segmented
          label={f.label}
          value={v || null}
          disabled={disabled}
          onChange={(x) => onChange(f.id, x === v ? '' : x)}
          options={f.options.map((o) => ({ value: o, label: o }))}
        />
      ) : (
        <Select id={fieldDomId(f.id)} options={f.options} value={v} disabled={disabled} onChange={(e) => onChange(f.id, e.target.value)} />
      )}
    </div>
  );
});

export function NoteField({ text }: { text: string }) {
  return (
    <p className="flex gap-2.5 rounded-ctl bg-info-soft px-3.5 py-3 text-[15px] leading-relaxed text-text">
      <Info className="mt-0.5 size-5 shrink-0 text-info" weight="fill" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
