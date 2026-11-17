import type { ReactNode } from 'react';
import type {
  CheckField,
  CheckValue,
  ContactAckValue,
  EquipmentRow,
  Field,
  FormData,
  FormDef,
  ScenarioTable,
} from '../forms/types';

// fieldId -> image data URLs (signatures, drawings, photos)
export type ReportImages = Record<string, string[]>;

export type ReportProps = {
  def: FormDef;
  data: FormData;
  images: ReportImages;
  settings: { companyName: string; companyDetails: string; stamp?: string };
  approver: { name: string; date: string; signature?: string };
  revision: number;
  inspectorName?: string;
};

const HEBREW = /[֐-׿]/;

export function formatDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

// isolates user text; hebrew values get an rtl base
function V({ v }: { v: unknown }) {
  const s = str(v);
  if (!s.trim()) return <span className="empty">—</span>;
  return HEBREW.test(s) ? <bdi dir="rtl">{s}</bdi> : <bdi>{s}</bdi>;
}

const NEGATIVE = new Set(['לא', 'לא מתאים', 'לא קיים', 'לא פעיל']);

function Img({ src, className }: { src?: string; className?: string }) {
  return src ? <img src={src} className={className} alt="" /> : null;
}

function Checks({ fields, data, sectionTitle }: { fields: CheckField[]; data: FormData; sectionTitle: string }) {
  const rows: ReactNode[] = [];
  let topic: string | undefined = sectionTitle;
  for (const f of fields) {
    if (f.topic && f.topic !== topic) {
      rows.push(
        <tr key={`t-${f.id}`} className="topic">
          <td colSpan={4}>{f.topic}</td>
        </tr>,
      );
    }
    topic = f.topic ?? topic;
    const v = (data[f.id] ?? {}) as CheckValue;
    const answers = [v.answer, f.answers === 'existsActive' && v.answer !== 'לא קיים' ? v.active : undefined].filter((a) => str(a));
    rows.push(
      <tr key={f.id}>
        <td className="clause">{f.clause ?? ''}</td>
        <td>
          {f.text}
          {f.inline && (
            <div className="inline">
              {f.inline.map((x) => (
                <span key={x.id}>
                  {x.label}: <V v={v.inline?.[x.id]} />
                </span>
              ))}
            </div>
          )}
        </td>
        <td className={`res${answers.some((a) => NEGATIVE.has(str(a))) ? ' bad' : ''}`}>
          {answers.length ? (
            answers.map((a, i) => (
              <div key={i}>
                <V v={a} />
              </div>
            ))
          ) : (
            <V v="" />
          )}
        </td>
        <td className="rem">{str(v.note) ? <V v={v.note} /> : null}</td>
      </tr>,
    );
  }
  return (
    <table className="checks">
      <thead>
        <tr>
          <th className="clause">סעיף</th>
          <th>דרישה</th>
          <th className="res">תוצאה</th>
          <th className="rem">הערה</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

function equipmentRow(value: unknown, row: string, i: number): EquipmentRow {
  if (Array.isArray(value)) return (value[i] ?? {}) as EquipmentRow;
  if (value && typeof value === 'object') {
    const r = value as Record<string, EquipmentRow>;
    return r[String(i)] ?? r[row] ?? {};
  }
  return {};
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={head.length} className="c">
              <span className="empty">—</span>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Scenario({ f, value }: { f: Extract<Field, { type: 'scenarioMatrix' }>; value: unknown }) {
  const tables = (Array.isArray(value) ? value : []) as ScenarioTable[];
  if (!tables.length) return <Table head={['פעולה', ...f.columns]} rows={[]} />;
  return (
    <>
      {tables.map((t, ti) => (
        <div key={ti} className="scenario">
          <div className="kv">
            {f.tableFields.map((tf) => (
              <div key={tf.id}>
                <span className="k">{tf.label}:</span>
                <span className="v">
                  <V v={t.fields?.[tf.id]} />
                </span>
              </div>
            ))}
          </div>
          <table className="matrix">
            <thead>
              <tr>
                <th>פעולה</th>
                {f.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.actions.map((a, ai) => {
                const label = a || str(t.actionLabels?.[ai]);
                const cells = t.cells?.[ai] ?? {};
                if (!a && !label && !Object.values(cells).some((c) => str(c))) return null;
                return (
                  <tr key={ai}>
                    <td>{a ? a : <V v={label} />}</td>
                    {f.columns.map((_, ci) => (
                      <td key={ci}>{str(cells[ci]) ? <V v={cells[ci]} /> : ''}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <div className="note">מקרא: {f.values.join(' / ')}</div>
    </>
  );
}

function FieldView({ f, p }: { f: Field; p: ReportProps }) {
  const v = p.data[f.id];
  const imgs = p.images[f.id] ?? [];
  // oldest first; newest signature wins
  const last = imgs.at(-1);
  switch (f.type) {
    case 'textarea':
      return (
        <div className="block">
          <div className="k">{f.label}</div>
          <div className="v">
            <V v={v} />
          </div>
        </div>
      );
    case 'note':
      return <div className="note">{f.text}</div>;
    case 'equipmentTable':
      return (
        <Table
          head={['סוג אביזר', 'יצרן', 'דגם', 'כמות']}
          rows={f.rows.map((row, i) => {
            const r = equipmentRow(v, row, i);
            return [row, <V v={r.manufacturer} />, <V v={r.model} />, <V v={r.qty} />];
          })}
        />
      );
    case 'repeatTable': {
      const rows = (Array.isArray(v) ? v : []) as Record<string, unknown>[];
      return (
        <>
          <h3>{f.label}</h3>
          <Table head={f.columns.map((c) => c.label)} rows={rows.map((r) => f.columns.map((c) => <V v={r?.[c.id]} />))} />
        </>
      );
    }
    case 'systemsGrid': {
      const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      const names = [...f.systems, ...Object.keys(m).filter((k) => !f.systems.includes(k) && str(m[k]))];
      return <Table head={['מערכת', 'כן / לא']} rows={names.map((n) => [f.systems.includes(n) ? n : <V v={n} />, <V v={m[n]} />])} />;
    }
    case 'contactAck': {
      const c = (v ?? {}) as ContactAckValue;
      return (
        <>
          <h3>{f.label}</h3>
          <Table
            head={['שם', 'תפקיד', 'טלפון', 'שעה', 'חתימה']}
            rows={[[<V v={c.name} />, <V v={c.role} />, <V v={c.phone} />, <V v={c.time} />, <Img src={last} className="td-sig" />]]}
          />
        </>
      );
    }
    case 'signature':
      if (f.role === 'approver') {
        return (
          <div className="approval">
            <div className="sig">
              <div className="who">
                <div>
                  {f.label}: <V v={p.approver.name} />
                </div>
                <div>
                  תאריך אישור: <V v={formatDate(p.approver.date)} />
                </div>
              </div>
              {p.approver.signature ? <Img src={p.approver.signature} /> : <div className="line" />}
            </div>
            <Img src={p.settings.stamp} className="stamp" />
          </div>
        );
      }
      return (
        <div className="sig">
          <div className="who">
            {f.label}: {p.inspectorName ? <V v={p.inspectorName} /> : null}
          </div>
          {last ? <Img src={last} /> : <div className="line" />}
        </div>
      );
    case 'drawing':
      return (
        <div className="drawing">
          {imgs.length ? imgs.map((src, i) => <Img key={i} src={src} />) : <span className="empty">—</span>}
        </div>
      );
    case 'scenarioMatrix':
      return <Scenario f={f} value={v} />;
    case 'photos':
    case 'check':
    case 'text':
    case 'number':
    case 'date':
    case 'time':
    case 'choice':
      return null;
    default: {
      const never: never = f;
      return never;
    }
  }
}

const SIMPLE = new Set(['text', 'number', 'date', 'time', 'choice']);

function SectionView({ s, p }: { s: FormDef['sections'][number]; p: ReportProps }) {
  // group runs of simple fields and of checks
  const out: ReactNode[] = [];
  let i = 0;
  while (i < s.fields.length) {
    const f = s.fields[i];
    if (SIMPLE.has(f.type)) {
      const run: Field[] = [];
      while (i < s.fields.length && SIMPLE.has(s.fields[i].type)) run.push(s.fields[i++]);
      out.push(
        <div key={`kv-${f.id}`} className="kv">
          {run.map((x) => {
            const raw = p.data[x.id];
            return (
              <div key={x.id}>
                <span className="k">{'label' in x ? x.label : ''}:</span>
                <span className="v">
                  <V v={x.type === 'date' ? formatDate(str(raw)) : raw} />
                </span>
              </div>
            );
          })}
        </div>,
      );
    } else if (f.type === 'signature') {
      const run: Field[] = [];
      while (i < s.fields.length && s.fields[i].type === 'signature') run.push(s.fields[i++]);
      out.push(
        <div key={`sg-${f.id}`} className="signs">
          {run.map((x) => (
            <FieldView key={x.id} f={x} p={p} />
          ))}
        </div>,
      );
    } else if (f.type === 'check') {
      const run: CheckField[] = [];
      while (i < s.fields.length && s.fields[i].type === 'check') run.push(s.fields[i++] as CheckField);
      out.push(<Checks key={`ch-${f.id}`} fields={run} data={p.data} sectionTitle={s.title} />);
    } else {
      out.push(<FieldView key={f.id} f={f} p={p} />);
      i++;
    }
  }
  return (
    <section className="section">
      <h2>{s.title}</h2>
      {out}
    </section>
  );
}

export function Report(p: ReportProps) {
  const photos = p.def.sections.flatMap((s) => s.fields).filter((f) => f.type === 'photos');
  const photoSrcs = photos.flatMap((f) => p.images[f.id] ?? []);
  const pages: string[][] = [];
  for (let i = 0; i < photoSrcs.length; i += 2) pages.push(photoSrcs.slice(i, i + 2));
  const body = p.def.sections.filter((s) => !s.fields.every((f) => f.type === 'photos'));
  return (
    <>
      <header className="head">
        <div>
          <div className="company-name">
            <V v={p.settings.companyName} />
          </div>
          {str(p.settings.companyDetails) ? (
            <div className="company-details">
              <V v={p.settings.companyDetails} />
            </div>
          ) : null}
        </div>
        <div className="doc">
          {p.def.docNumber ? <div className="num">{p.def.docNumber}</div> : null}
          <div>גרסת טופס {p.def.version}</div>
          {p.revision > 0 ? <div className="rev">Rev {p.revision} (תיקון)</div> : null}
        </div>
      </header>
      <h1>{p.def.title}</h1>
      {body.map((s) => (
        <SectionView key={s.id} s={s} p={p} />
      ))}
      {pages.map((pg, i) => (
        <section key={i} className="photo-page">
          <h2>
            נספח תמונות ({i + 1}/{pages.length})
          </h2>
          {pg.map((src, j) => (
            <div key={j} className="photo">
              <img src={src} alt="" />
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
