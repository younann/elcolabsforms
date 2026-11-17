import { useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FilePlus,
  Files,
  GearSix,
  House,
  SignOut,
  Tray,
  UserCircle,
  UsersThree,
  type IconProps,
} from '@phosphor-icons/react';
import { useAuth, type Role } from '../lib/auth';
import { InstallBanner } from '../pwa/InstallBanner';
import { Brand } from './Brand';
import { cx } from './cx';

type Tab = { to: string; label: string; Icon: ComponentType<IconProps>; end?: boolean };

const TABS: Record<Role, Tab[]> = {
  inspector: [
    { to: '/', label: 'הטפסים שלי', Icon: House, end: true },
    { to: '/new', label: 'טופס חדש', Icon: FilePlus },
    { to: '/profile', label: 'פרופיל', Icon: UserCircle },
  ],
  admin: [
    { to: '/', label: 'לאישור', Icon: Tray, end: true },
    { to: '/admin/submissions', label: 'כל הטפסים', Icon: Files },
    { to: '/admin/users', label: 'משתמשים', Icon: UsersThree },
    { to: '/admin/settings', label: 'הגדרות', Icon: GearSix },
    { to: '/profile', label: 'פרופיל', Icon: UserCircle },
  ],
};

// full-screen task pages carry their own bottom bar
const TASK = /^\/(fill|submissions|admin\/review)\//;

/** Logged-in frame: bottom tabs on phones, side navigation from 1024px. */
export function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [leaving, setLeaving] = useState(false);
  const tabs = TABS[user?.role ?? 'inspector'];
  const task = TASK.test(pathname);

  async function onLogout() {
    setLeaving(true);
    try {
      await logout();
    } finally {
      setLeaving(false);
    }
  }

  const logoutBtn = (withLabel: boolean) => (
    <button
      type="button"
      onClick={onLogout}
      disabled={leaving}
      aria-label="יציאה"
      className="press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-ctl px-2.5 text-[15px] font-medium text-muted transition-[transform,background-color,color] duration-150 hover:bg-surface-2 hover:text-text active:scale-[0.97] disabled:opacity-50"
    >
      <SignOut className="size-5 -scale-x-100" aria-hidden />
      {withLabel && <span>יציאה</span>}
    </button>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:[--nav-w:15rem]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-border bg-surface px-3 pt-[calc(var(--safe-top)+1rem)] pb-4 lg:flex">
        <NavLink to="/" className="press mb-6 flex min-h-11 items-center rounded-ctl px-2" aria-label="דף הבית">
          <Brand />
        </NavLink>
        <nav className="flex flex-col gap-1" aria-label="ניווט ראשי">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cx(
                  'press flex min-h-11 items-center gap-3 rounded-ctl px-3 text-[15px] font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.98]',
                  isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2/60 hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <t.Icon className={cx('size-5 shrink-0', isActive && 'text-accent')} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-[15px] font-medium" data-testid="user-name">
              {user?.displayName}
            </p>
            <p className="text-[13px] text-muted">{user?.role === 'admin' ? 'מנהל' : 'בודק'}</p>
          </div>
          {logoutBtn(false)}
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="safe-x sticky top-0 z-30 border-b border-border bg-bg/90 pt-[var(--safe-top)] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2">
            <NavLink to="/" className="press me-1 flex min-h-11 min-w-11 items-center rounded-ctl" aria-label="דף הבית">
              <Brand />
            </NavLink>
            <div className="ms-auto flex items-center gap-1">
              <span className="hidden max-w-[16ch] truncate text-[15px] text-muted sm:inline">{user?.displayName}</span>
              {logoutBtn(false)}
            </div>
          </div>
        </header>
        <main
          className={cx(
            'safe-x mx-auto w-full max-w-5xl flex-1 pt-5 md:pt-8 lg:px-8 lg:pt-10',
            task ? 'safe-bottom' : 'pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-12',
          )}
        >
          <InstallBanner />
          <Outlet />
        </main>
      </div>

      {!task && (
        <nav
          aria-label="ניווט ראשי"
          className="safe-x fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/92 pb-[var(--safe-bottom)] backdrop-blur-md lg:hidden"
        >
          <ul className="mx-auto grid max-w-lg auto-cols-fr grid-flow-col">
            {tabs.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cx(
                      'press flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[12px] font-medium transition-[transform,color] duration-150 active:scale-[0.94]',
                      isActive ? 'text-accent' : 'text-muted',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <t.Icon className="size-6" weight={isActive ? 'fill' : 'regular'} aria-hidden />
                      <span className="max-w-full truncate">{t.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
