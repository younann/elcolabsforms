import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Banner } from '../ui';

export type MailMode = 'log' | 'live';

// one request per page load
let cached: Promise<MailMode | null> | null = null;
const fetchMode = () =>
  (cached ??= api<{ settings: { mailMode?: MailMode } }>('/api/settings')
    .then((r) => r.settings.mailMode ?? null)
    .catch(() => {
      cached = null;
      return null;
    }));

/** Server mail mode, admins only; null while unknown. */
export function useMailMode(): MailMode | null {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const [mode, setMode] = useState<MailMode | null>(null);
  useEffect(() => {
    if (!admin) return;
    let alive = true;
    void fetchMode().then((m) => alive && setMode(m));
    return () => {
      alive = false;
    };
  }, [admin]);
  return admin ? mode : null;
}

export function MailModeBanner({ className = 'mb-5' }: { className?: string }) {
  if (useMailMode() !== 'log') return null;
  return (
    <Banner tone="warning" title="מצב בדיקה: מיילים אינם נשלחים" className={className}>
      דוחות מופקים ונשמרים, אבל המייל רק נרשם ביומן השרת. אחרי חיבור שליחה אמיתית אפשר לשלוח אותם שוב.
    </Banner>
  );
}

export function MailLoggedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap text-warning" data-testid="mail-logged">
      מצב בדיקה – לא נשלח
    </span>
  );
}
