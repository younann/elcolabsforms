import { memo, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { Button, Segmented, TextField, cx } from '../../ui';
import type { EquipmentRow, Field, ScenarioTable } from '../../../shared/forms/types';
import { fieldDomId } from '../context';
import { Label, Select, arr, obj, str, type FieldProps } from './inputs';

type Equip = Extract<Field, { type: 'equipmentTable' }>;
type Repeat = Extract<Field, { type: 'repeatTable' }>;
type Systems = Extract<Field, { type: 'systemsGrid' }>;
type Scenario = Extract<Field, { type: 'scenarioMatrix' }>;

function RemoveButton({ onClick, label, disabled }: { onClick(): void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="press grid size-11 shrink-0 place-items-center rounded-full text-muted transition-[transform,background-color,color] duration-150 ease-snap hover:bg-danger-soft hover:text-danger active:scale-[0.94] disabled:opacity-40"
    >
      <Trash className="size-5" aria-hidden />
    </button>
  );
}

export const EquipmentTableField = memo(function EquipmentTableField({ field: f, value, onChange, disabled }: FieldProps<Equip>) {
  const rows = f.rows.map((_, i) => arr<EquipmentRow>(value)[i] ?? {});
  const set = (i: number, patch: Partial<EquipmentRow>) =>
    onChange(
      f.id,
      rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    );
  return (
    <div id={fieldDomId(f.id)} tabIndex={-1} className="scroll-mt-36 outline-none">
      <ul className="divide-y divide-border">
        {f.rows.map((row, i) => (
          <li key={row} className="py-3.5">
            <p className="mb-2 font-semibold">{row}</p>
            <div className="grid grid-cols-[1fr_1fr_5.5rem] gap-2">
              <TextField label="יצרן" value={rows[i].manufacturer ?? ''} disabled={disabled} onChange={(e) => set(i, { manufacturer: e.target.value })} />
              <TextField label="דגם" value={rows[i].model ?? ''} disabled={disabled} onChange={(e) => set(i, { model: e.target.value })} />
              <TextField
                label="כמות"
                inputMode="numeric"
                dir="ltr"
                className="[&_input]:text-center"
                value={rows[i].qty ?? ''}
                disabled={disabled}
                onChange={(e) => set(i, { qty: e.target.value })}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});

export const RepeatTableField = memo(function RepeatTableField({ field: f, value, onChange, disabled }: FieldProps<Repeat>) {
  const rows = arr<Record<string, string>>(value);
  const min = f.minRows ?? 0;
  const set = (next: Record<string, string>[]) => onChange(f.id, next);
  return (
    <div id={fieldDomId(f.id)} tabIndex={-1} className="scroll-mt-36 outline-none">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <Label required={min > 0}>{f.label}</Label>
        <span className="shrink-0 text-sm text-muted tabular-nums">{rows.length} שורות</span>
      </div>
      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={i} className="rounded-box bg-surface shadow-[var(--shadow-card)] p-3.5 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-muted tabular-nums">שורה {i + 1}</span>
              {!disabled && <RemoveButton label={`מחיקת שורה ${i + 1}`} onClick={() => set(rows.filter((_, j) => j !== i))} />}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {f.columns.map((c) =>
                c.type === 'choice' ? (
                  <div key={c.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={`${f.id}-${i}-${c.id}`}>{c.label}</Label>
                    <Select
                      id={`${f.id}-${i}-${c.id}`}
                      options={c.options ?? []}
                      value={r[c.id] ?? ''}
                      disabled={disabled}
                      onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, [c.id]: e.target.value } : x)))}
                    />
                  </div>
                ) : (
                  <TextField
                    key={c.id}
                    label={c.label}
                    inputMode={c.type === 'number' ? 'decimal' : undefined}
                    value={r[c.id] ?? ''}
                    disabled={disabled}
                    onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, [c.id]: e.target.value } : x)))}
                  />
                ),
              )}
            </div>
          </li>
        ))}
      </ol>
      {!disabled && (
        <Button variant="secondary" className="mt-3" icon={<Plus className="size-5" aria-hidden />} onClick={() => set([...rows, {}])}>
          הוספת שורה
        </Button>
      )}
    </div>
  );
});

const YES_NO = [
  { value: 'כן', label: 'כן' },
  { value: 'לא', label: 'לא' },
];

type Other = { name: string; value: string };

export const SystemsGridField = memo(function SystemsGridField({ field: f, value, onChange, disabled }: FieldProps<Systems>) {
  const m = obj<Record<string, string>>(value);
  // other rows keep their order while the name is typed
  const [others, setOthers] = useState<Other[]>(() =>
    Object.entries(m)
      .filter(([k]) => !f.systems.includes(k))
      .map(([name, v]) => ({ name, value: str(v) })),
  );
  const write = (fixed: Record<string, string>, list: Other[]) => {
    const out: Record<string, string> = {};
    for (const s of f.systems) if (fixed[s]) out[s] = fixed[s];
    for (const o of list) if (o.name.trim() && !f.systems.includes(o.name.trim())) out[o.name.trim()] = o.value;
    onChange(f.id, out);
  };
  const setOther = (list: Other[]) => {
    setOthers(list);
    write(m, list);
  };
  return (
    <div id={fieldDomId(f.id)} tabIndex={-1} className="scroll-mt-36 outline-none">
      <ul className="divide-y divide-border">
        {f.systems.map((s) => (
          <li key={s} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[16px]">{s}</span>
            <Segmented
              className="sm:w-44"
              label={s}
              value={m[s] ?? null}
              disabled={disabled}
              onChange={(x) => write({ ...m, [s]: m[s] === x ? '' : x }, others)}
              options={YES_NO}
            />
          </li>
        ))}
        {others.map((o, i) => (
          <li key={i} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-end">
            <TextField
              className="flex-1"
              label="מערכת אחרת"
              value={o.name}
              disabled={disabled}
              onChange={(e) => setOther(others.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <div className="flex items-center gap-1">
              <Segmented
                className="flex-1 sm:w-44"
                label={o.name || 'מערכת אחרת'}
                value={o.value || null}
                disabled={disabled}
                onChange={(x) => setOther(others.map((y, j) => (j === i ? { ...y, value: y.value === x ? '' : x } : y)))}
                options={YES_NO}
              />
              {!disabled && <RemoveButton label="מחיקת מערכת" onClick={() => setOther(others.filter((_, j) => j !== i))} />}
            </div>
          </li>
        ))}
      </ul>
      {f.allowOther && !disabled && (
        <Button variant="secondary" className="mt-3" icon={<Plus className="size-5" aria-hidden />} onClick={() => setOthers([...others, { name: '', value: '' }])}>
          מערכת אחרת
        </Button>
      )}
    </div>
  );
});

const emptyTable = (): ScenarioTable => ({ fields: {}, cells: {} });

export const ScenarioMatrixField = memo(function ScenarioMatrixField({ field: f, value, onChange, disabled }: FieldProps<Scenario>) {
  const stored = arr<ScenarioTable>(value);
  const tables = stored.length ? stored : [emptyTable()];
  const set = (i: number, t: ScenarioTable) => onChange(f.id, tables.map((x, j) => (j === i ? t : x)));
  return (
    <div id={fieldDomId(f.id)} tabIndex={-1} className="scroll-mt-36 flex flex-col gap-4 outline-none">
      <p className="text-sm text-muted">מקרא: {f.values.join(' / ')}</p>
      {tables.map((t, ti) => (
        <section key={ti} className="rounded-box bg-surface shadow-[var(--shadow-card)] p-3.5" aria-label={`טבלה ${ti + 1}`}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-semibold tabular-nums">טבלה {ti + 1}</h4>
            {!disabled && tables.length > 1 && (
              <RemoveButton label={`מחיקת טבלה ${ti + 1}`} onClick={() => onChange(f.id, tables.filter((_, j) => j !== ti))} />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {f.tableFields.map((tf) => (
              <TextField
                key={tf.id}
                label={tf.label}
                value={t.fields?.[tf.id] ?? ''}
                disabled={disabled}
                onChange={(e) => set(ti, { ...t, fields: { ...t.fields, [tf.id]: e.target.value } })}
              />
            ))}
          </div>
          <div className="-mx-3.5 mt-4 overflow-x-auto overscroll-x-contain px-3.5 pb-1">
            <table className="w-max min-w-full border-separate border-spacing-1 text-[15px]">
              <thead>
                <tr>
                  <th className="sticky start-0 z-10 w-36 bg-surface text-start font-semibold">פעולה</th>
                  {f.columns.map((c) => (
                    <th key={c} className="w-20 px-1 text-center text-[13px] leading-tight font-semibold text-muted">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {f.actions.map((a, ai) => (
                  <tr key={ai}>
                    <th scope="row" className="sticky start-0 z-10 bg-surface py-0.5 pe-2 text-start font-normal">
                      {a ? (
                        <span className="block w-36 text-[14px] leading-snug">{a}</span>
                      ) : (
                        <input
                          aria-label={`פעולה נוספת ${ai + 1}`}
                          placeholder="פעולה נוספת"
                          className="min-h-11 w-36 rounded-ctl border border-border-strong bg-surface px-2.5 text-[16px] focus:border-accent focus:outline-none disabled:bg-surface-2"
                          value={t.actionLabels?.[ai] ?? ''}
                          disabled={disabled}
                          onChange={(e) => set(ti, { ...t, actionLabels: { ...t.actionLabels, [ai]: e.target.value } })}
                        />
                      )}
                    </th>
                    {f.columns.map((c, ci) => {
                      const cell = t.cells?.[ai]?.[ci] ?? '';
                      return (
                        <td key={ci}>
                          <select
                            aria-label={`${a || t.actionLabels?.[ai] || 'פעולה'} – ${c}`}
                            value={cell}
                            disabled={disabled}
                            onChange={(e) =>
                              set(ti, { ...t, cells: { ...t.cells, [ai]: { ...t.cells?.[ai], [ci]: e.target.value } } })
                            }
                            className={cx(
                              'min-h-11 w-full min-w-16 appearance-none rounded-ctl border text-center text-[16px] font-semibold focus:border-accent focus:outline-none',
                              cell ? 'border-ink bg-ink text-ink-fg' : 'border-border-strong bg-surface text-muted',
                            )}
                          >
                            <option value="">–</option>
                            {f.values.map((x) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!disabled && (
        <Button variant="secondary" className="self-start" icon={<Plus className="size-5" aria-hidden />} onClick={() => onChange(f.id, [...tables, emptyTable()])}>
          הוספת טבלה
        </Button>
      )}
    </div>
  );
});
