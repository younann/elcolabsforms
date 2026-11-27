import { useRef, useState } from 'react';
import { FilePdf, Trash, UploadSimple } from '@phosphor-icons/react';
import { ApiError } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';
import { deleteStandard, listStandards, patchStandard, standardPdfUrl, uploadStandard, STD_MAX, type Standard } from '../../lib/standards';
import { Button, FormChecks, Sheet, TextField, toast } from '../../ui';
import { FORMS } from '../../../shared/forms';

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;
const err = (e: unknown, fallback: string) => {
  if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : fallback);
};

/** Admin uploads standard pdfs; the AI chat answers from them per form type. */
export function StandardsCard() {
  const { data, reload } = useLoad(listStandards, 'standards');
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [edit, setEdit] = useState<Standard | null>(null);

  function pick(f: File) {
    if (f.type !== 'application/pdf') return toast.error('יש לבחור קובץ PDF');
    if (f.size > STD_MAX) return toast.error('הקובץ גדול מ-50MB');
    setFile(f);
  }

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-box bg-surface p-4 shadow-[var(--shadow-card)] md:p-6" data-testid="standards">
      <h2 className="text-lg font-semibold">תקנים (PDF) לעוזר ה-AI</h2>
      <p className="text-[15px] text-muted">ה-AI עונה לבודקים לפי התקנים של סוג הטופס. סמנו לכל קובץ לאילו טפסים הוא שייך.</p>
      <ul className="divide-y divide-border">
        {(data ?? []).map((s) => (
          <li key={s.id} className="flex min-h-14 items-center gap-3 py-2">
            <FilePdf className="size-6 shrink-0 text-danger" aria-hidden />
            <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setEdit(s)}>
              <span className="block truncate font-semibold">{s.name}</span>
              <span className="block truncate text-[13px] text-muted">
                {s.formIds.map((id) => FORMS.find((f) => f.id === id)?.shortTitle ?? id).join(', ') || 'לא שויך לטופס'} · {mb(s.size)}
              </span>
            </button>
            <a href={standardPdfUrl(s.id)} target="_blank" rel="noopener" className="text-[15px] font-medium text-accent">
              פתיחה
            </a>
          </li>
        ))}
        {data && !data.length && <li className="py-2 text-[15px] text-muted">עדיין לא הועלו תקנים</li>}
      </ul>
      <input ref={input} type="file" accept="application/pdf" className="sr-only" data-testid="standard-input" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
      <Button variant="secondary" className="self-start" icon={<UploadSimple className="size-5" aria-hidden />} onClick={() => input.current?.click()}>
        העלאת תקן
      </Button>
      <StandardSheet
        key={file ? `new:${file.name}` : edit?.id ?? 'none'}
        file={file}
        standard={edit}
        onClose={() => {
          setFile(null);
          setEdit(null);
          if (input.current) input.current.value = '';
        }}
        onDone={() => void reload()}
      />
    </div>
  );
}

function StandardSheet({ file, standard, onClose, onDone }: { file: File | null; standard: Standard | null; onClose(): void; onDone(): void }) {
  const [name, setName] = useState(standard?.name ?? file?.name.replace(/\.pdf$/i, '') ?? '');
  const [formIds, setFormIds] = useState<string[]>(standard?.formIds ?? []);
  const [busy, setBusy] = useState<number | 'del' | null>(null);
  const open = !!file || !!standard;

  async function save() {
    if (busy !== null || !name.trim()) return;
    setBusy(0);
    try {
      if (file) await uploadStandard(file, name.trim(), formIds, (p) => setBusy(p));
      else if (standard) await patchStandard(standard.id, { name: name.trim(), formIds });
      toast.success(file ? 'התקן הועלה' : 'התקן עודכן');
      onDone();
      onClose();
    } catch (e) {
      err(e, 'השמירה נכשלה');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!standard || busy !== null) return;
    setBusy('del');
    try {
      await deleteStandard(standard.id);
      toast.success('התקן נמחק');
      onDone();
      onClose();
    } catch (e) {
      err(e, 'המחיקה נכשלה');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={file ? 'העלאת תקן' : 'עריכת תקן'}
      footer={
        <div className="flex gap-2">
          {standard && <Button variant="danger" aria-label="מחיקה" loading={busy === 'del'} icon={<Trash className="size-5" aria-hidden />} onClick={remove} />}
          <Button variant="primary" className="flex-1" size="lg" loading={typeof busy === 'number'} disabled={!name.trim()} onClick={save} data-testid="standard-save">
            {typeof busy === 'number' && file ? `מעלה… ${Math.round(busy * 100)}%` : 'שמירה'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {file && <p className="text-[15px] text-muted">{`${file.name} · ${mb(file.size)}`}</p>}
        <TextField label="שם התקן" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder='לדוגמה: ת"י 1220 חלק 3' />
        <FormChecks label="שייך לטפסים" value={formIds} onChange={setFormIds} />
      </div>
    </Sheet>
  );
}
