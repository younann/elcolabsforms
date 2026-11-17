import { useState, type FormEvent } from 'react';
import { CaretLeft, Plus, UsersThree, WarningOctagon } from '@phosphor-icons/react';
import { api, ApiError } from '../../lib/api';
import { useAuth, type Role } from '../../lib/auth';
import { useLoad } from '../../lib/useLoad';
import { Banner, Button, EmptyState, Segmented, Sheet, TextField, cx, toast } from '../../ui';
import { ListSkeleton } from '../../components/SubmissionList';

type U = { id: string; username: string; displayName: string; role: Role; active: boolean };

const ROLE_OPTIONS = [
  { value: 'inspector' as const, label: 'בודק' },
  { value: 'admin' as const, label: 'מנהל' },
];

function errText(e: unknown) {
  if (e instanceof ApiError && Array.isArray(e.body.issues)) {
    const msg = (e.body.issues as { message?: string }[]).map((i) => i.message).find((m) => m && /[֐-׿]/.test(m));
    if (msg) return msg;
  }
  return e instanceof Error ? e.message : 'הפעולה נכשלה';
}

export function Users() {
  const { user: me } = useAuth();
  const { data, error, reload } = useLoad(() => api<{ users: U[] }>('/api/users').then((r) => r.users), 'users');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<U | null>(null);

  return (
    <section>
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight">משתמשים</h1>
        <Button variant="accent" icon={<Plus className="size-5" weight="bold" aria-hidden />} onClick={() => setCreating(true)}>
          משתמש חדש
        </Button>
      </div>

      <div className="mt-5">
        {error && !data ? (
          <EmptyState icon={<WarningOctagon />} title="לא ניתן לטעון" action={<Button onClick={reload}>נסה שוב</Button>}>
            {error}
          </EmptyState>
        ) : !data ? (
          <ListSkeleton rows={4} />
        ) : data.length === 0 ? (
          <EmptyState icon={<UsersThree />} title="אין משתמשים" />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="users-list">
            {data.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setEditing(u)}
                  className={cx(
                    'press flex min-h-[4.25rem] w-full items-center gap-3 rounded-box border border-border bg-surface px-4 py-3 text-start transition-[transform,border-color] duration-150 ease-snap hover:border-border-strong active:scale-[0.99]',
                    !u.active && 'bg-surface-2/50',
                  )}
                >
                  <span
                    className={cx(
                      'grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold',
                      u.active ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
                    )}
                    aria-hidden
                  >
                    {u.displayName.trim().charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block truncate text-[17px] font-semibold', !u.active && 'text-muted')}>
                      {u.displayName}
                      {u.id === me?.id && <span className="ms-1.5 text-sm font-normal text-muted">(אני)</span>}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      <bdi>{u.username}</bdi>
                    </span>
                  </span>
                  <span
                    className={cx(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold',
                      !u.active ? 'bg-danger-soft text-danger' : u.role === 'admin' ? 'bg-info-soft text-info' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {!u.active ? 'מושבת' : u.role === 'admin' ? 'מנהל' : 'בודק'}
                  </span>
                  <CaretLeft className="size-4 shrink-0 text-muted max-sm:hidden" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          void reload();
        }}
      />
      <EditSheet
        user={editing}
        self={editing?.id === me?.id}
        onClose={() => setEditing(null)}
        onSaved={(u) => {
          setEditing(u);
          void reload();
        }}
      />
    </section>
  );
}

function CreateSheet({ open, onClose, onCreated }: { open: boolean; onClose(): void; onCreated(): void }) {
  const [form, setForm] = useState({ displayName: '', username: '', password: '', role: 'inspector' as Role });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api('/api/users', { method: 'POST', json: form });
      toast.success(`המשתמש ${form.displayName} נוצר`);
      setForm({ displayName: '', username: '', password: '', role: 'inspector' });
      onCreated();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="משתמש חדש"
      footer={
        <Button type="submit" form="create-user" variant="primary" block size="lg" loading={busy}>
          יצירת משתמש
        </Button>
      }
    >
      <form id="create-user" onSubmit={submit} className="flex flex-col gap-4">
        {err && <Banner tone="danger">{err}</Banner>}
        <TextField label="שם מלא" required maxLength={80} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <TextField
          label="שם משתמש"
          hint="אותיות לועזיות, ספרות, נקודה או מקף"
          required
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          pattern="[A-Za-z0-9._\-]{3,32}"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <TextField
          label="סיסמה"
          hint="לפחות 6 תווים"
          required
          minLength={6}
          dir="ltr"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] font-medium">תפקיד</span>
          <Segmented label="תפקיד" value={form.role} onChange={(role) => setForm({ ...form, role })} options={ROLE_OPTIONS} />
        </div>
      </form>
    </Sheet>
  );
}

function EditSheet({ user, self, onClose, onSaved }: { user: U | null; self: boolean; onClose(): void; onSaved(u: U): void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  // reset fields when another user opens
  if (user && user.id !== lastId) {
    setLastId(user.id);
    setName(user.displayName);
    setPassword('');
    setErr(null);
  }

  async function patch(kind: string, body: Partial<{ displayName: string; role: Role; active: boolean; password: string }>, done: string) {
    if (!user || busy) return;
    setBusy(kind);
    setErr(null);
    try {
      const r = await api<{ user: U }>(`/api/users/${user.id}`, { method: 'PATCH', json: body });
      toast.success(done);
      if (kind === 'password') setPassword('');
      onSaved(r.user);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) setErr(errText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={user !== null} onClose={onClose} title={user?.displayName ?? ''}>
      {user && (
        <div className="flex flex-col gap-6">
          {err && <Banner tone="danger">{err}</Banner>}
          <p className="-mt-1 text-[15px] text-muted">
            שם משתמש: <bdi className="font-medium text-text">{user.username}</bdi>
          </p>

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name.trim() !== user.displayName) void patch('name', { displayName: name.trim() }, 'השם עודכן');
            }}
          >
            <TextField label="שם מלא" className="min-w-0 flex-1" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" variant="secondary" className="min-h-12" loading={busy === 'name'} disabled={!name.trim() || name.trim() === user.displayName}>
              שמירה
            </Button>
          </form>

          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] font-medium">תפקיד</span>
            <Segmented
              label="תפקיד"
              value={user.role}
              disabled={self || busy !== null}
              onChange={(role) => role !== user.role && void patch('role', { role }, 'התפקיד עודכן')}
              options={ROLE_OPTIONS}
            />
            {self && <p className="text-sm text-muted">לא ניתן לשנות את התפקיד של עצמך.</p>}
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (password.length >= 6) void patch('password', { password }, 'הסיסמה אופסה. המשתמש ינותק מכל המכשירים');
            }}
          >
            <TextField
              label="סיסמה חדשה"
              hint="לפחות 6 תווים. המשתמש ינותק מכל המכשירים."
              className="min-w-0 flex-1"
              dir="ltr"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="secondary" className="mb-7 min-h-12" loading={busy === 'password'} disabled={password.length < 6}>
              איפוס
            </Button>
          </form>

          {!self && (
            <div className="border-t border-border pt-5">
              {user.active ? (
                <Button variant="danger" block loading={busy === 'active'} onClick={() => patch('active', { active: false }, 'המשתמש הושבת')}>
                  השבתת משתמש
                </Button>
              ) : (
                <Button variant="primary" block loading={busy === 'active'} onClick={() => patch('active', { active: true }, 'המשתמש הופעל')}>
                  הפעלת משתמש
                </Button>
              )}
              <p className="mt-2 text-sm text-muted">
                {user.active ? 'משתמש מושבת לא יוכל להיכנס. הטפסים שלו נשמרים.' : 'המשתמש יוכל להיכנס שוב עם הסיסמה שלו.'}
              </p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
