import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { APP_NAME, Banner, Button, DevCredit, LogoMark, TAGLINE, TextField } from '../ui';

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
        <div className="flex flex-col items-center pt-6 text-center md:pt-0">
          <LogoMark className="size-24 drop-shadow-[0_10px_18px_rgb(143_108_14/0.35)]" />
          <p className="mt-4 text-[34px] leading-none font-bold tracking-[0.12em] text-gold" dir="ltr">
            {APP_NAME}
          </p>
          <p className="mt-2 text-[15px] font-medium text-muted">{TAGLINE}</p>
        </div>
        <h1 className="mt-12 text-[28px] leading-tight font-bold">כניסה</h1>

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
        <DevCredit className="mt-6" />
      </div>
    </div>
  );
}
