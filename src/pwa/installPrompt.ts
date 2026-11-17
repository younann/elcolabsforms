export type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'install-dismissed-at';
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

let saved: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// registered at import so an early event is not lost
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    saved = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    saved = null;
    listeners.forEach((l) => l());
  });
}

export function getSavedPrompt(): InstallPromptEvent | null {
  return saved;
}

export function clearSavedPrompt(): void {
  saved = null;
}

export function subscribePrompt(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isDismissed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && now - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function markDismissed(now = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    // storage unavailable
  }
}
