export type InstallMode = 'installed' | 'android-prompt' | 'ios-safari' | 'ios-other' | 'unsupported';

/** Classifies how (or whether) this browser can install the app. */
export function getInstallMode(ua: string, standalone: boolean): InstallMode {
  if (standalone) return 'installed';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua) ? 'ios-other' : 'ios-safari';
  }
  if (/Android/i.test(ua)) return 'android-prompt';
  return 'unsupported';
}

/** Reads the live environment. */
export function currentInstallMode(): InstallMode {
  if (typeof navigator === 'undefined') return 'unsupported';
  let ua = navigator.userAgent;
  // iPadOS reports as a Mac
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ua += ' iPad';
  const standalone =
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return getInstallMode(ua, standalone);
}
