export type Status = 'draft' | 'submitted' | 'returned' | 'approved' | 'sending' | 'emailed' | 'send_failed';
export type Action = 'submit' | 'return' | 'approve' | 'reopen' | 'retry' | 'edit';
export type Role = 'admin' | 'inspector';

// from -> action -> next status; roles allowed per action
const NEXT: Record<Action, Partial<Record<Status, Status>>> = {
  submit: { draft: 'submitted', returned: 'submitted' },
  return: { submitted: 'returned' },
  approve: { submitted: 'sending' },
  reopen: { emailed: 'submitted' },
  retry: { send_failed: 'sending' },
  edit: { draft: 'draft', returned: 'returned', submitted: 'submitted' },
};

export const STUCK_MS = 15 * 60_000;

// retry from sending only when stuck; from emailed only when the mail was only logged
export function canTransition(
  from: Status,
  action: Action,
  role: Role,
  updatedAt?: Date,
  now = Date.now(),
  mailLogged = false,
): Status | null {
  if (action === 'edit') {
    const ok = role === 'admin' ? from === 'submitted' : from === 'draft' || from === 'returned';
    return ok ? NEXT.edit[from] ?? null : null;
  }
  if (action === 'submit') return NEXT.submit[from] ?? null;
  if (role !== 'admin') return null;
  if (action === 'retry' && from === 'emailed') return mailLogged ? 'sending' : null;
  if (action === 'retry' && from === 'sending') return updatedAt && now - updatedAt.getTime() > STUCK_MS ? 'sending' : null;
  return NEXT[action][from] ?? null;
}
