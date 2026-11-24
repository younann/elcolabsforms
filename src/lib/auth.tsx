import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, setUnauthorizedHandler } from './api';
import { disablePush } from '../pwa/push';
import { flushAll } from './autosave';
import { clearLoadCache } from './useLoad';
import { ShellSkeleton } from '../ui/ShellSkeleton';

export type Role = 'admin' | 'inspector' | 'engineer';

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  hasSignature: boolean;
};

type AuthValue = {
  user: User | null;
  loading: boolean;
  login(username: string, password: string): Promise<User>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
const CACHE_KEY = 'auth:user';

// offline fallback so field users are not bounced to login
function readCache(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCache(user: User | null) {
  // another user must never see cached lists
  if (!user || user.id !== readCache()?.id) clearLoadCache();
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // storage unavailable
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const setUser = useCallback((u: User | null) => {
    writeCache(u);
    setUserState(u);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: User }>('/api/auth/me');
      setUser(user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setUserState(readCache());
      else setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // session expired mid-use: back to login, then return here
  const from = location;
  useEffect(
    () =>
      setUnauthorizedHandler(() => {
        setUser(null);
        navigate('/login', { replace: true, state: { from } });
      }),
    [navigate, setUser, from],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const { user } = await api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        json: { username, password },
      });
      setUser(user);
      return user;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await flushAll();
    await disablePush();
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // cookie cleared locally anyway
    }
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate, setUser]);

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** Gates children (or nested routes) behind login and an optional role. */
export function RequireRole({ role, children }: { role?: Role; children?: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <ShellSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children ?? <Outlet />}</>;
}
