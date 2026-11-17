import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SignOut } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { Brand } from './Brand';
import { cx } from './cx';

const navCls = ({ isActive }: { isActive: boolean }) =>
  cx(
    'press inline-flex min-h-11 items-center rounded-ctl px-3 text-[15px] font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.97]',
    isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text',
  );

/** Logged-in frame: sticky header plus routed content. */
export function AppShell() {
  const { user, logout } = useAuth();
  const [leaving, setLeaving] = useState(false);

  async function onLogout() {
    setLeaving(true);
    try {
      await logout();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-x sticky top-0 z-30 border-b border-border bg-bg/90 pt-[var(--safe-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2">
          <NavLink to="/" className="press me-1 flex min-h-11 min-w-11 items-center rounded-ctl" aria-label="דף הבית">
            <Brand compact={user?.role === 'admin'} />
          </NavLink>
          {user?.role === 'admin' && (
            <nav className="flex items-center gap-1" aria-label="ניווט ראשי">
              <NavLink to="/" end className={navCls}>
                טפסים
              </NavLink>
              <NavLink to="/admin" className={navCls}>
                ניהול
              </NavLink>
            </nav>
          )}
          <div className="ms-auto flex items-center gap-1">
            <span className="hidden max-w-[16ch] truncate text-[15px] text-muted sm:inline" data-testid="user-name">
              {user?.displayName}
            </span>
            <button
              type="button"
              onClick={onLogout}
              disabled={leaving}
              aria-label="יציאה"
              className="press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-ctl px-2.5 text-[15px] font-medium text-muted transition-[transform,background-color,color] duration-150 hover:bg-surface-2 hover:text-text active:scale-[0.97] disabled:opacity-50"
            >
              <SignOut className="size-5 -scale-x-100" aria-hidden />
              <span className="hidden md:inline">יציאה</span>
            </button>
          </div>
        </div>
      </header>
      <main className="safe-x safe-bottom mx-auto w-full max-w-5xl flex-1 pt-5 md:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
