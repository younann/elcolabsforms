import { ClipboardText } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { EmptyState } from '../ui';

export function Home() {
  const { user } = useAuth();
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">שלום, {user?.displayName}</h1>
      <EmptyState icon={<ClipboardText />} title="אין עדיין טפסים" className="mt-6">
        טפסים שתמלא יופיעו כאן.
      </EmptyState>
    </section>
  );
}
