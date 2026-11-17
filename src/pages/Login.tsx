import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { Banner, Brand, Button, TextField } from '../ui';

const fine = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

export function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from;
  const target = from && from.pathname !== '/login' ? `${from.pathname}${from.search}` : '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user && !busy) return <Navigate to={target} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('יש למלא שם משתמש וסיסמה');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'הכניסה נכשלה, נסה שוב');
      setBusy(false);
    }
  }

  return (
    <div className="safe-x flex min-h-dvh flex-col pt-[max(2rem,var(--safe-top))] pb-[max(1.5rem,var(--safe-bottom))] md:items-center md:justify-center md:pb-[12vh]">
      <div className="mx-auto w-full max-w-[400px]">
        <Brand size="lg" />
        <h1 className="mt-10 text-[28px] leading-tight font-semibold tracking-tight md:mt-12">כניסה</h1>
        <p className="mt-1.5 text-muted">טפסי בדיקה לבטיחות אש</p>

        <form noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
          <TextField
            label="שם משתמש"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            autoFocus={fine}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
          />
          <TextField
            label="סיסמה"
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            end={
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
                aria-pressed={show}
                className="press grid size-11 place-items-center rounded-ctl text-muted transition-transform duration-150 active:scale-[0.94]"
              >
                {show ? <EyeSlash className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            }
          />

          {error && <Banner tone="danger">{error}</Banner>}

          <Button type="submit" size="lg" block loading={busy} className="mt-1">
            כניסה
          </Button>
        </form>

        <p className="mt-8 text-sm text-muted">אין לך חשבון? מנהל המערכת יפתח לך משתמש.</p>
      </div>
    </div>
  );
}
