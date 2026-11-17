import { Link } from 'react-router-dom';
import { ClipboardText, Plus } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { EmptyState } from '../ui';

export function Home() {
  const { user } = useAuth();
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">שלום, {user?.displayName}</h1>
      <EmptyState
        icon={<ClipboardText />}
        title="אין עדיין טפסים"
        className="mt-6"
        action={
          <Link
            to="/new"
            className="press inline-flex min-h-11 items-center gap-2 rounded-ctl bg-accent px-4 font-medium text-accent-fg transition-transform duration-150 ease-snap active:scale-[0.97]"
          >
            <Plus className="size-5" aria-hidden />
            טופס חדש
          </Link>
        }
      >
        טפסים שתמלא יופיעו כאן.
      </EmptyState>
    </section>
  );
}
