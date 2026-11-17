import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { flushAll } from '../lib/autosave';
import { Banner, Button } from '../ui';

const CHECK_MS = 30 * 60 * 1000;

/** Offers a new version; saves drafts before reloading. */
export function UpdateBanner() {
  const reg = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      reg.current = r;
    },
  });

  useEffect(() => {
    const check = () => {
      void reg.current?.update().catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(check, CHECK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, []);

  if (!needRefresh) return null;

  async function onUpdate() {
    setBusy(true);
    try {
      await flushAll();
      await updateServiceWorker(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="safe-x pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[max(0.75rem,var(--safe-bottom))]">
      <div className="pointer-events-auto mx-auto max-w-md transition-[opacity,transform] duration-200 ease-snap starting:translate-y-2 starting:opacity-0">
        <Banner
          tone="info"
          title="גרסה חדשה זמינה"
          className="shadow-lg"
          action={
            <Button size="md" variant="primary" loading={busy} onClick={onUpdate}>
              עדכן עכשיו
            </Button>
          }
        >
          הטיוטות נשמרות לפני העדכון.
        </Banner>
      </div>
    </div>
  );
}
