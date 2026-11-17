import { useRef, useState } from 'react';
import { CircleNotch, MapPin } from '@phosphor-icons/react';
import { api, ApiError } from '../../lib/api';
import { Button, Sheet, cx, toast } from '../../ui';

type Geo = { address: string };

export const hasGeolocation = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }),
  );
}

function geoError(e: unknown): string {
  const code = (e as GeolocationPositionError | undefined)?.code;
  if (code === 1) return 'יש לאשר גישה למיקום בהגדרות הדפדפן';
  if (code === 3) return 'איתור המיקום לקח יותר מדי זמן. נסה שוב';
  if (code === 2) return 'לא ניתן לאתר את המיקום כרגע. נסה שוב';
  if (e instanceof ApiError && e.status === 404) return 'לא נמצאה כתובת למיקום הזה';
  return e instanceof Error ? e.message : 'איתור הכתובת נכשל';
}

/** Fills an address field from the device location. */
export function LocateButton({ value, onFill }: { value: string; onFill(address: string): void }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  // latest text, typing may continue during lookup
  const current = useRef(value);
  current.current = value;

  async function locate() {
    if (busy) return;
    setBusy(true);
    try {
      const p = await position();
      const { latitude: lat, longitude: lon } = p.coords;
      const r = await api<Geo>(`/api/geocode/reverse?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`);
      // never overwrite text silently
      const now = current.current.trim();
      if (now && now !== r.address) setPending(r.address);
      else onFill(r.address);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(geoError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={locate}
        aria-label="מילוי לפי המיקום הנוכחי"
        aria-busy={busy || undefined}
        data-testid="locate-address"
        className={cx(
          'press grid size-11 touch-manipulation place-items-center rounded-ctl text-accent select-none',
          'transition-[transform,background-color] duration-150 ease-snap hover:bg-surface-2 active:scale-[0.94]',
        )}
      >
        {busy ? <CircleNotch className="size-5 animate-spin" aria-hidden /> : <MapPin className="size-[22px]" weight="fill" aria-hidden />}
      </button>
      <Sheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title="להחליף את הכתובת הקיימת?"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>
              ביטול
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              data-testid="confirm-locate"
              onClick={() => {
                if (pending) onFill(pending);
                setPending(null);
              }}
            >
              החלפה
            </Button>
          </div>
        }
      >
        <dl className="flex flex-col gap-3 text-[15px] leading-relaxed">
          <div>
            <dt className="text-muted">הכתובת הנוכחית</dt>
            <dd className="font-medium">{value}</dd>
          </div>
          <div>
            <dt className="text-muted">לפי המיקום</dt>
            <dd className="font-semibold">{pending}</dd>
          </div>
        </dl>
      </Sheet>
    </>
  );
}
