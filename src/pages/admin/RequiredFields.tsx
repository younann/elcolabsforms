import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { saveRequired } from '../../lib/required';
import { Button, Select, cx, toast } from '../../ui';
import { FORMS } from '../../../shared/forms';
import { defaultRequired, isSwitchable, type RequiredOverrides } from '../../../shared/forms/required';
import { labelOf } from '../../../shared/forms/validate';

/** Admin picks which fields of each form must be filled before submit. */
export function RequiredFieldsCard({ initial }: { initial: RequiredOverrides }) {
  const [all, setAll] = useState(initial);
  const [formId, setFormId] = useState<string>(FORMS[0].id);
  const def = FORMS.find((f) => f.id === formId)!;
  const [draft, setDraft] = useState<Record<string, boolean>>(all[formId] ?? {});
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(all[formId] ?? {});

  function pick(id: string) {
    setFormId(id);
    setDraft(all[id] ?? {});
  }

  async function save(next: Record<string, boolean>) {
    if (busy) return;
    setBusy(true);
    try {
      setAll(await saveRequired(formId, next));
      setDraft(next);
      toast.success('שדות החובה נשמרו');
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'השמירה נכשלה');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-box bg-surface shadow-[var(--shadow-card)] p-4 md:p-6" data-testid="required-fields">
      <h2 className="text-lg font-semibold">שדות חובה</h2>
      <p className="text-[15px] text-muted">מה הבודק חייב למלא לפני שליחה. חל על כל העבודות.</p>
      <Select label="טופס" value={formId} disabled={dirty} title={dirty ? 'שמור או בטל לפני מעבר טופס' : undefined} onChange={(e) => pick(e.target.value)}>
        {FORMS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.shortTitle}
          </option>
        ))}
      </Select>
      {def.sections.map((s) => {
        const fields = s.fields.filter(isSwitchable);
        if (!fields.length) return null;
        return (
          <fieldset key={s.id}>
            <legend className="text-[15px] font-semibold">{s.title}</legend>
            <ul className="mt-1 divide-y divide-border">
              {fields.map((f) => {
                const on = draft[f.id] ?? defaultRequired(f);
                return (
                  <li key={f.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                      <span className="min-w-0 flex-1 text-[15px] leading-snug">{labelOf(f)}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        className="peer sr-only"
                        checked={on}
                        onChange={(e) => {
                          const next = { ...draft };
                          // store only choices that differ from the default
                          if (e.target.checked === defaultRequired(f)) delete next[f.id];
                          else next[f.id] = e.target.checked;
                          setDraft(next);
                        }}
                      />
                      <span
                        aria-hidden
                        className={cx(
                          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
                          on ? 'bg-accent' : 'bg-border-strong',
                        )}
                      >
                        <span className={cx('absolute top-0.5 size-6 rounded-full bg-surface shadow transition-[inset-inline-start] duration-150', on ? 'start-[1.375rem]' : 'start-0.5')} />
                      </span>
                      <span className={cx('w-12 shrink-0 text-[13px]', on ? 'font-semibold' : 'text-muted')}>{on ? 'חובה' : 'רשות'}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={busy || !Object.keys(all[formId] ?? {}).length} onClick={() => save({})}>
          ברירת מחדל
        </Button>
        {dirty && (
          <Button variant="secondary" disabled={busy} onClick={() => setDraft(all[formId] ?? {})}>
            ביטול
          </Button>
        )}
        <Button variant="primary" loading={busy} disabled={!dirty} onClick={() => save(draft)}>
          שמירה
        </Button>
      </div>
    </div>
  );
}
