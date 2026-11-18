import { memo, useState } from 'react';
import { NotePencil } from '@phosphor-icons/react';
import { Segmented, TextField, cx, type SegmentOption } from '../../ui';
import { ACTIVE_OPTIONS, ANSWER_OPTIONS, EXISTS_OPTIONS, type CheckField as CheckDef, type CheckValue } from '../../../shared/forms/types';
import { fieldDomId } from '../context';
import { TextArea, obj, type FieldProps } from './inputs';

const POSITIVE = new Set(['כן', 'מתאים', 'קיים', 'פעיל']);
const NEGATIVE = new Set(['לא', 'לא מתאים', 'לא קיים', 'לא פעיל']);

const toOptions = (list: string[]): SegmentOption<string>[] =>
  list.map((o) => ({ value: o, label: o, tone: POSITIVE.has(o) ? 'success' : NEGATIVE.has(o) ? 'danger' : 'ink' }));

export const CheckField = memo(function CheckField({ field: f, value, onChange, disabled }: FieldProps<CheckDef>) {
  const v = obj<CheckValue>(value);
  const [noteOpen, setNoteOpen] = useState(false);
  const set = (patch: Partial<CheckValue>) => onChange(f.id, { ...v, ...patch });
  const toggle = (cur: string | undefined, next: string) => (cur === next ? undefined : next);
  const exists = f.answers === 'existsActive';
  const answered = !!v.answer && (!exists || v.answer === 'לא קיים' || !!v.active);
  const showNote = noteOpen || !!v.note;

  return (
    <div id={fieldDomId(f.id)} tabIndex={-1} className="scroll-mt-36 py-4 outline-none" data-answered={answered || undefined}>
      <div className="flex items-start gap-3">
        {f.clause && (
          <span
            className={cx(
              'mt-0.5 inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-[13px] font-semibold tabular-nums transition-colors duration-150',
              answered ? 'bg-ink text-ink-fg' : 'bg-surface-2 text-muted',
            )}
          >
            {f.clause}
          </span>
        )}
        <p className="min-w-0 flex-1 text-[16px] leading-relaxed text-pretty">{f.text}</p>
      </div>

      {f.inline && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {f.inline.map((x) => (
            <TextField
              key={x.id}
              label={x.label}
              value={v.inline?.[x.id] ?? ''}
              disabled={disabled}
              onChange={(e) => set({ inline: { ...v.inline, [x.id]: e.target.value } })}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Segmented
          label={f.clause ? `סעיף ${f.clause}` : f.text}
          value={v.answer ?? null}
          disabled={disabled}
          onChange={(a) => set(exists && a === 'לא קיים' ? { answer: toggle(v.answer, a), active: undefined, auto: undefined } : { answer: toggle(v.answer, a), auto: undefined })}
          options={toOptions(exists ? EXISTS_OPTIONS : ANSWER_OPTIONS[f.answers as keyof typeof ANSWER_OPTIONS])}
        />
        {exists && v.answer === 'קיים' && (
          <Segmented
            label={`${f.text} – מצב`}
            value={v.active ?? null}
            disabled={disabled}
            onChange={(a) => set({ active: toggle(v.active, a) })}
            options={toOptions(ACTIVE_OPTIONS)}
          />
        )}
      </div>

      {showNote ? (
        <TextArea
          className="mt-3"
          label="הערה"
          rows={2}
          value={v.note ?? ''}
          disabled={disabled}
          autoFocus={noteOpen && !v.note}
          onChange={(e) => set({ note: e.target.value })}
        />
      ) : (
        !disabled && (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="press -ms-2 mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-[15px] font-medium text-muted transition-[transform,color] duration-150 ease-snap hover:text-text active:scale-[0.97]"
          >
            <NotePencil className="size-[18px]" aria-hidden />
            הוספת הערה
          </button>
        )
      )}
    </div>
  );
});
