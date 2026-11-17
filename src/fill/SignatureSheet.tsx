import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { ArrowCounterClockwise, UserCircleCheck } from '@phosphor-icons/react';
import { Button, Sheet } from '../ui';
import { canvasToPng } from '../lib/image';

export type SignatureSheetProps = {
  open: boolean;
  title: string;
  onClose(): void;
  onSave(blob: Blob): Promise<void>;
  /** Offers the profile signature when set. */
  onUseSaved?: () => Promise<void>;
};

/** Finger signature pad in a sheet. */
export function SignatureSheet({ open, title, onClose, onSave, onUseSaved }: SignatureSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState<'save' | 'saved' | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!open || !canvas) return;
    const pad = new SignaturePad(canvas, { penColor: '#15181c', minWidth: 0.9, maxWidth: 2.6, throttle: 8 });
    padRef.current = pad;
    const onEnd = () => setEmpty(pad.isEmpty());
    pad.addEventListener('endStroke', onEnd);

    // match backing store to css size, keep strokes
    const fit = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      // offset size ignores the open transition's transform
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (!width || !height) return;
      const data = pad.toData();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      if (data.length) pad.fromData(data);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    setEmpty(true);
    return () => {
      ro.disconnect();
      pad.removeEventListener('endStroke', onEnd);
      pad.off();
      padRef.current = null;
    };
  }, [open]);

  function clear() {
    padRef.current?.clear();
    setEmpty(true);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !padRef.current || padRef.current.isEmpty()) return;
    setBusy('save');
    try {
      await onSave(await canvasToPng(canvas));
      onClose();
    } catch {
      // caller reports
    } finally {
      setBusy(null);
    }
  }

  async function pickSaved() {
    if (!onUseSaved) return;
    setBusy('saved');
    try {
      await onUseSaved();
      onClose();
    } catch {
      // caller reports
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" onClick={save} disabled={empty || busy !== null} loading={busy === 'save'}>
            שמירת חתימה
          </Button>
          {onUseSaved && (
            <Button
              variant="secondary"
              className="flex-1"
              icon={<UserCircleCheck className="size-5" aria-hidden />}
              onClick={pickSaved}
              disabled={busy !== null}
              loading={busy === 'saved'}
            >
              החתימה השמורה שלי
            </Button>
          )}
        </div>
      }
    >
      <div className="relative overflow-hidden rounded-box border border-border-strong bg-[#fdfdfd]">
        <canvas
          ref={canvasRef}
          aria-label="משטח חתימה"
          data-testid="signature-canvas"
          className="block h-56 w-full touch-none select-none md:h-64"
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-dashed border-[#b9bfc6]" aria-hidden />
        <button
          type="button"
          onClick={clear}
          disabled={empty}
          className="press absolute end-1.5 top-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-3 text-[15px] font-medium text-[#565d66] transition-[transform,opacity] duration-150 ease-snap active:scale-[0.97] disabled:opacity-0"
        >
          <ArrowCounterClockwise className="size-[18px]" aria-hidden />
          ניקוי
        </button>
      </div>
      <p className="mt-2 text-center text-sm text-muted">חתום באצבע בתוך המסגרת</p>
    </Sheet>
  );
}
