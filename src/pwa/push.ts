import { api } from '../lib/api';
import { currentInstallMode } from './platform';

export function pushSupport(): 'ok' | 'needs-install' | 'unsupported' {
  const mode = currentInstallMode();
  // iOS pushes only to an installed app
  if (mode === 'ios-safari' || mode === 'ios-other') return 'needs-install';
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ok';
}

function keyBytes(b64: string) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function enablePush(): Promise<boolean> {
  if (pushSupport() !== 'ok') return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const [{ key }, reg] = await Promise.all([api<{ key: string }>('/api/push/key'), navigator.serviceWorker.ready]);
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await api('/api/push/subscribe', { method: 'POST', json: sub.toJSON() });
  return true;
}

/** Drops this device's subscription; quiet on failure. */
export async function disablePush(): Promise<void> {
  try {
    if (pushSupport() !== 'ok' || !navigator.serviceWorker.controller) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await api('/api/push/subscribe', { method: 'DELETE', json: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    // logout must not fail
  }
}
