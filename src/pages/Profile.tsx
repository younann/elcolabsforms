import { useState } from 'react';
import { PenNib, Signature } from '@phosphor-icons/react';
import { api, ApiError } from '../lib/api';
import { ROLE_LABEL, useAuth } from '../lib/auth';
import { Button, DevCredit, toast } from '../ui';
import { SignatureSheet } from '../fill/SignatureSheet';

/** Own details and the saved signature, for every role. */
export function Profile() {
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(() => Date.now());

  async function save(blob: Blob) {
    try {
      const fd = new FormData();
      fd.set('file', blob, 'signature.png');
      await api('/api/profile/signature', { method: 'PUT', body: fd });
      await refresh();
      setV(Date.now());
      toast.success('החתימה נשמרה');
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'שמירת החתימה נכשלה');
      throw e;
    }
  }

  if (!user) return null;
  const admin = user.role === 'admin';
  return (
    <section className="max-w-2xl">
      <h1 className="text-[28px] leading-tight font-bold sm:text-[32px]">פרופיל</h1>

      <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-box bg-surface shadow-[var(--shadow-card)] p-4 sm:grid-cols-2 md:p-6">
        <div>
          <dt className="text-sm text-muted">שם</dt>
          <dd className="text-[17px] font-semibold">{user.displayName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">שם משתמש</dt>
          <dd className="text-[17px] font-semibold">
            <bdi>{user.username}</bdi>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">תפקיד</dt>
          <dd className="text-[17px] font-semibold">{ROLE_LABEL[user.role]}</dd>
        </div>
      </dl>

      <div className="mt-5 rounded-box bg-surface shadow-[var(--shadow-card)] p-4 md:p-6">
        <h2 className="text-lg font-semibold">החתימה השמורה שלי</h2>
        <p className="mt-1 text-[15px] text-muted">
          {admin ? 'החתימה מוטבעת בתיבת המאשר בכל דוח שתאשר.' : 'אפשר להוסיף אותה לטופס בהקשה אחת במקום לחתום מחדש.'}
        </p>
        <div className="mt-4 grid h-40 place-items-center overflow-hidden rounded-box border border-dashed border-border-strong bg-[#fdfdfd]">
          {user.hasSignature ? (
            <img src={`/api/profile/signature?v=${v}`} alt="החתימה השמורה שלי" className="max-h-full max-w-full object-contain p-3" data-testid="saved-signature" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-[15px] text-[#565d66]">
              <Signature className="size-8" aria-hidden />
              אין חתימה שמורה
            </span>
          )}
        </div>
        <Button variant={user.hasSignature ? 'secondary' : 'primary'} className="mt-4" icon={<PenNib className="size-5" aria-hidden />} onClick={() => setOpen(true)}>
          {user.hasSignature ? 'החלפת חתימה' : 'הוספת חתימה'}
        </Button>
      </div>

      <SignatureSheet open={open} title="החתימה שלי" onClose={() => setOpen(false)} onSave={save} />
      <DevCredit className="mt-8" />
    </section>
  );
}
