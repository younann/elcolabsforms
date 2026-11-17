import { memo, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, CircleNotch, Image as ImageIcon, PencilSimpleLine, Signature, Trash, X } from '@phosphor-icons/react';
import { Button, toast } from '../../ui';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/image';
import type { ContactAckValue, Field } from '../../../shared/forms/types';
import { fieldDomId, useFill, type Attachment } from '../context';
import { SignatureSheet } from '../SignatureSheet';
import { DrawingSheet } from '../DrawingSheet';
import { Label, obj, type FieldProps } from './inputs';

type Sig = Extract<Field, { type: 'signature' }>;
type Ack = Extract<Field, { type: 'contactAck' }>;
type Photos = Extract<Field, { type: 'photos' }>;
type Drawing = Extract<Field, { type: 'drawing' }>;

const errMsg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'הפעולה נכשלה');

async function fetchSaved(): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch('/api/profile/signature', { credentials: 'include' });
  } catch {
    throw new Error('אין חיבור לשרת. בדוק את החיבור לרשת ונסה שוב');
  }
  if (res.status === 401) {
    // same session-expiry path as api(): flush, then login
    await api('/api/profile').catch(() => undefined);
    throw new Error('נדרשת התחברות');
  }
  if (res.status === 404) throw new Error('אין חתימה שמורה בפרופיל');
  if (!res.ok) throw new Error('טעינת החתימה השמורה נכשלה');
  return res.blob();
}

/** Signature slot: preview plus sheet; keeps one attachment per field. */
function SignatureSlot({ fieldId, title, disabled }: { fieldId: string; title: string; disabled?: boolean }) {
  const { attachments, upload, remove, readOnly } = useFill();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const show = () => {
    setMounted(true);
    setOpen(true);
  };
  const current = attachments.filter((a) => a.fieldId === fieldId && a.kind === 'signature');
  // the report uses the newest, so show the same
  const sig = current.at(-1);
  const locked = disabled || readOnly;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // old signature must go so the report picks the new one
  async function dropOld(ids: string[]) {
    for (const id of ids) {
      for (let attempt = 0; ; attempt++) {
        try {
          await remove(id);
          break;
        } catch {
          if (attempt === 2) toast.error('מחיקת החתימה הקודמת נכשלה. מנסה שוב ברקע');
          if (attempt >= 2 && !alive.current) return;
          await new Promise((r) => setTimeout(r, attempt < 2 ? 1000 * (attempt + 1) : 10_000));
        }
      }
    }
  }

  async function replace(blob: Blob) {
    const old = current.map((a) => a.id);
    try {
      await upload(fieldId, 'signature', blob, 'signature.png');
    } catch (e) {
      toast.error(errMsg(e));
      throw e;
    }
    // first tries block the sheet; later ones run in the background
    await Promise.race([dropOld(old), new Promise((r) => setTimeout(r, 3500))]);
  }

  async function applySaved() {
    let blob: Blob;
    try {
      blob = await fetchSaved();
    } catch (e) {
      toast.error(errMsg(e));
      throw e;
    }
    await replace(blob);
  }

  return (
    <>
      {sig ? (
        <div className="flex items-center gap-3">
          <div className="relative grid h-24 flex-1 place-items-center rounded-box border border-border bg-[#fdfdfd] p-2">
            <img src={sig.url} alt={`חתימה: ${title}`} className="max-h-full max-w-full object-contain" />
            {current.length > 1 && (
              <span className="absolute inset-x-2 bottom-1 flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#8a5300]" role="status">
                <CircleNotch className="size-3.5 animate-spin" aria-hidden />
                מעדכן חתימה…
              </span>
            )}
          </div>
          {!locked && (
            <Button variant="secondary" onClick={show}>
              חתימה מחדש
            </Button>
          )}
        </div>
      ) : locked ? (
        <p className="rounded-box border border-dashed border-border-strong px-4 py-5 text-center text-muted">לא נחתם</p>
      ) : (
        <button
          type="button"
          onClick={show}
          className="press flex min-h-24 w-full items-center justify-center gap-2.5 rounded-box border-2 border-dashed border-border-strong bg-surface text-[17px] font-medium text-text transition-[transform,border-color,background-color] duration-150 ease-snap hover:border-accent hover:bg-accent-soft active:scale-[0.99]"
        >
          <Signature className="size-6 text-accent" aria-hidden />
          הוספת חתימה
        </button>
      )}
      {!locked && mounted && (
        <SignatureSheet
          open={open}
          title={title}
          onClose={() => setOpen(false)}
          onSave={replace}
          onUseSaved={user?.hasSignature ? applySaved : undefined}
        />
      )}
    </>
  );
}

export const SignatureField = memo(function SignatureField({ field: f, disabled }: FieldProps<Sig>) {
  const { mode } = useFill();
  if (f.role === 'approver') {
    // filled from the approver profile at approval
    return (
      <div id={fieldDomId(f.id)} className="flex flex-col gap-1.5">
        <Label>{f.label}</Label>
        <p className="rounded-box bg-surface-2 px-4 py-3 text-[15px] text-muted">
          {mode === 'admin' ? 'החתימה השמורה שלך תצורף בעת האישור' : 'ייחתם על ידי המאשר'}
        </p>
      </div>
    );
  }
  return (
    <div id={fieldDomId(f.id)} tabIndex={-1} className="scroll-mt-36 flex flex-col gap-1.5 outline-none">
      <Label required>{f.label}</Label>
      <SignatureSlot fieldId={f.id} title={f.label} disabled={disabled} />
    </div>
  );
});

export const ContactAckField = memo(function ContactAckField({ field: f, value, onChange, disabled }: FieldProps<Ack>) {
  const v = obj<ContactAckValue>(value);
  const set = (k: keyof ContactAckValue, x: string) => onChange(f.id, { ...v, [k]: x });
  const input = (k: keyof ContactAckValue, label: string, extra: Record<string, string> = {}) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-medium">{label}</span>
      <input
        className="block min-h-12 w-full rounded-ctl border border-border-strong bg-surface px-3.5 text-[17px] focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none disabled:bg-surface-2 disabled:text-muted"
        value={v[k] ?? ''}
        disabled={disabled}
        onChange={(e) => set(k, e.target.value)}
        {...extra}
      />
    </label>
  );
  return (
    <fieldset id={fieldDomId(f.id)} className="flex flex-col gap-3">
      <legend className="mb-3 font-semibold">{f.label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {input('name', 'שם')}
        {input('role', 'תפקיד')}
        {input('phone', 'טלפון', { type: 'tel', inputMode: 'tel', dir: 'ltr', autoComplete: 'off' })}
        {input('time', 'שעה', { type: 'time' })}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[15px] font-medium">חתימה</span>
        <SignatureSlot fieldId={f.id} title={`חתימה – ${v.name || f.label}`} disabled={disabled} />
      </div>
    </fieldset>
  );
});

type Pending = { key: number; name: string };

function useImageUpload(fieldId: string) {
  const { upload } = useFill();
  const [pending, setPending] = useState<Pending[]>([]);
  const seq = useRef(0);

  async function add(files: FileList | File[], kind: 'photo' = 'photo') {
    const list = [...files];
    const items = list.map((f) => ({ key: ++seq.current, name: f.name }));
    setPending((p) => [...p, ...items]);
    // one at a time keeps memory low on phones
    for (let i = 0; i < list.length; i++) {
      try {
        const blob = await compressImage(list[i]);
        await upload(fieldId, kind, blob, 'photo.jpg');
      } catch (e) {
        toast.error(`העלאת ${list[i].name || 'התמונה'} נכשלה: ${errMsg(e)}`);
      } finally {
        setPending((p) => p.filter((x) => x.key !== items[i].key));
      }
    }
  }
  return { pending, add };
}

function Thumb({ a, locked }: { a: Attachment; locked: boolean }) {
  const { remove } = useFill();
  const [busy, setBusy] = useState(false);
  return (
    <li className="relative aspect-square overflow-hidden rounded-box bg-surface-2">
      <img src={a.url} alt="" loading="lazy" className="size-full object-cover" />
      {!locked && (
        <button
          type="button"
          aria-label="מחיקת תמונה"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await remove(a.id);
            } catch (e) {
              toast.error(errMsg(e));
              setBusy(false);
            }
          }}
          className="press absolute end-1 top-1 grid size-11 place-items-center rounded-full transition-transform duration-150 ease-snap active:scale-[0.92]"
        >
          <span className="grid size-8 place-items-center rounded-full bg-[rgb(14_17_21/0.62)] text-white backdrop-blur-sm">
            {busy ? <CircleNotch className="size-4 animate-spin" aria-hidden /> : <X className="size-4" weight="bold" aria-hidden />}
          </span>
        </button>
      )}
    </li>
  );
}

function PendingTile() {
  return (
    <li className="grid aspect-square place-items-center rounded-box bg-surface-2" aria-label="מעלה תמונה">
      <CircleNotch className="size-6 animate-spin text-muted" aria-hidden />
    </li>
  );
}

function FilePicker({ onPick, multiple, children, testId }: { onPick(files: FileList): void; multiple?: boolean; children: React.ReactNode; testId?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        data-testid={testId}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = '';
        }}
      />
      <Button variant="secondary" icon={<Camera className="size-5" aria-hidden />} onClick={() => ref.current?.click()}>
        {children}
      </Button>
    </>
  );
}

export const PhotosField = memo(function PhotosField({ field: f, disabled }: FieldProps<Photos>) {
  const { attachments, readOnly } = useFill();
  const { pending, add } = useImageUpload(f.id);
  const photos = attachments.filter((a) => a.fieldId === f.id);
  const locked = !!disabled || readOnly;
  return (
    <div id={fieldDomId(f.id)} className="flex flex-col gap-3">
      {photos.length + pending.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" aria-label="תמונות שצורפו">
          {photos.map((a) => (
            <Thumb key={a.id} a={a} locked={locked} />
          ))}
          {pending.map((p) => (
            <PendingTile key={p.key} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-box border border-dashed border-border-strong px-4 py-8 text-center text-muted">
          <ImageIcon className="size-8" aria-hidden />
          <p>לא צורפו תמונות</p>
        </div>
      )}
      {!locked && (
        <div>
          <FilePicker multiple onPick={(files) => void add(files)} testId="photos-input">
            צילום או בחירת תמונות
          </FilePicker>
        </div>
      )}
    </div>
  );
});

export const DrawingField = memo(function DrawingField({ field: f, disabled }: FieldProps<Drawing>) {
  const { attachments, upload, readOnly } = useFill();
  const { pending, add } = useImageUpload(f.id);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const items = attachments.filter((a) => a.fieldId === f.id);
  const locked = !!disabled || readOnly;
  return (
    <div id={fieldDomId(f.id)} className="flex flex-col gap-3">
      <Label>{f.label}</Label>
      {items.length + pending.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((a) => (
            <DrawingTile key={a.id} a={a} locked={locked} />
          ))}
          {pending.map((p) => (
            <li key={p.key} className="grid aspect-[4/3] place-items-center rounded-box bg-surface-2">
              <CircleNotch className="size-6 animate-spin text-muted" aria-hidden />
            </li>
          ))}
        </ul>
      )}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<PencilSimpleLine className="size-5" aria-hidden />} onClick={() => {
              setMounted(true);
              setOpen(true);
            }}
          >
            שרטוט
          </Button>
          <FilePicker onPick={(files) => void add(files)}>תמונה במקום שרטוט</FilePicker>
        </div>
      )}
      {!locked && mounted && (
        <DrawingSheet
          open={open}
          title={f.label}
          onClose={() => setOpen(false)}
          onSave={async (blob) => {
            try {
              await upload(f.id, 'drawing', blob, 'drawing.png');
            } catch (e) {
              toast.error(errMsg(e));
              throw e;
            }
          }}
        />
      )}
    </div>
  );
});

function DrawingTile({ a, locked }: { a: Attachment; locked: boolean }) {
  const { remove } = useFill();
  const [busy, setBusy] = useState(false);
  return (
    <li className="relative overflow-hidden rounded-box border border-border bg-white">
      <img src={a.url} alt="תרשים" className="aspect-[4/3] w-full object-contain" />
      {!locked && (
        <Button
          variant="secondary"
          className="absolute end-2 top-2"
          aria-label="מחיקת תרשים"
          loading={busy}
          icon={<Trash className="size-5" aria-hidden />}
          onClick={async () => {
            setBusy(true);
            try {
              await remove(a.id);
            } catch (e) {
              toast.error(errMsg(e));
              setBusy(false);
            }
          }}
        />
      )}
    </li>
  );
}
