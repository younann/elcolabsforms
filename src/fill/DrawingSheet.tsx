import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { getStroke } from 'perfect-freehand';
import { ArrowUUpRight, Eraser } from '@phosphor-icons/react';
import { Button, Sheet } from '../ui';
import { canvasToPng } from '../lib/image';

type Point = [number, number, number];

// logical canvas size; scaled to fit
const W = 1200;
const H = 900;

const STROKE = { size: 6, thinning: 0.55, smoothing: 0.5, streamline: 0.45 };

function pathOf(points: Point[], last: boolean) {
  const outline = getStroke(points, { ...STROKE, last, simulatePressure: points.every((p) => p[2] === 0.5) });
  const p = new Path2D();
  if (!outline.length) return p;
  p.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    p.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  p.closePath();
  return p;
}

export type DrawingSheetProps = {
  open: boolean;
  title: string;
  onClose(): void;
  onSave(blob: Blob): Promise<void>;
};

/** Freehand sketch with undo and clear. */
export function DrawingSheet({ open, title, onClose, onSave }: DrawingSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const live = useRef<{ id: number; points: Point[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const paint = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#15181c';
    for (const s of strokes) ctx.fill(pathOf(s, true));
    if (live.current) ctx.fill(pathOf(live.current.points, false));
  }, [strokes]);

  useEffect(() => {
    if (open) setStrokes([]);
  }, [open]);

  useEffect(paint, [paint]);

  function point(e: PointerEvent<HTMLCanvasElement>): Point {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H, e.pointerType === 'pen' ? e.pressure : 0.5];
  }

  function down(e: PointerEvent<HTMLCanvasElement>) {
    // one finger at a time
    if (live.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { id: e.pointerId, points: [point(e)] };
    paint();
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (live.current?.id !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const r = e.currentTarget.getBoundingClientRect();
    for (const ev of events) {
      live.current.points.push([((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H, ev.pointerType === 'pen' ? ev.pressure : 0.5]);
    }
    requestAnimationFrame(paint);
  }

  function up(e: PointerEvent<HTMLCanvasElement>) {
    if (live.current?.id !== e.pointerId) return;
    const s = live.current.points;
    live.current = null;
    setStrokes((prev) => [...prev, s]);
  }

  async function save() {
    const c = canvasRef.current;
    if (!c || !strokes.length) return;
    setBusy(true);
    try {
      paint();
      await onSave(await canvasToPng(c));
      onClose();
    } catch {
      // caller reports
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save} disabled={!strokes.length || busy} loading={busy}>
            שמירת תרשים
          </Button>
          <Button
            variant="secondary"
            aria-label="ביטול פעולה אחרונה"
            icon={<ArrowUUpRight className="size-5" aria-hidden />}
            disabled={!strokes.length || busy}
            onClick={() => setStrokes((s) => s.slice(0, -1))}
          >
            <span className="max-sm:sr-only">ביטול</span>
          </Button>
          <Button
            variant="secondary"
            aria-label="ניקוי התרשים"
            icon={<Eraser className="size-5" aria-hidden />}
            disabled={!strokes.length || busy}
            onClick={() => setStrokes([])}
          >
            <span className="max-sm:sr-only">ניקוי</span>
          </Button>
        </div>
      }
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        aria-label="משטח שרטוט"
        data-testid="drawing-canvas"
        className="block aspect-[4/3] w-full touch-none rounded-box border border-border-strong bg-white select-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </Sheet>
  );
}
