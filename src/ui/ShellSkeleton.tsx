/** Placeholder matching the shell while the session loads. */
export function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="טוען" className="min-h-dvh">
      <div className="safe-x border-b border-border pt-[var(--safe-top)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3">
          <div className="size-8 rounded-ctl bg-surface-2" />
          <div className="h-4 w-28 rounded-full bg-surface-2" />
        </div>
      </div>
      <div className="safe-x mx-auto max-w-5xl space-y-3 pt-6">
        <div className="h-6 w-40 rounded-full bg-surface-2" />
        <div className="h-20 rounded-box bg-surface-2" />
        <div className="h-20 rounded-box bg-surface-2 opacity-70" />
      </div>
    </div>
  );
}
