import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy } from '@phosphor-icons/react';
import { ApiError } from '../lib/api';
import { duplicate } from '../lib/submissions';
import { Button, toast, type ButtonProps } from '../ui';

/** Copies a submission into a new draft and opens it. */
export function DuplicateButton({ id, ...rest }: { id: string } & Omit<ButtonProps, 'onClick'>) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const newId = await duplicate(id);
      toast.success('נוצרה טיוטה חדשה');
      navigate(`/fill/${newId}`);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast.error(e instanceof Error ? e.message : 'השכפול נכשל');
      setBusy(false);
    }
  }
  return (
    <Button variant="ghost" loading={busy} icon={<Copy className="size-5" aria-hidden />} onClick={run} {...rest}>
      שכפול
    </Button>
  );
}
