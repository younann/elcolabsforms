export type Status =
  | 'draft'
  | 'submitted'
  | 'returned'
  | 'approved'
  | 'sending'
  | 'emailed'
  | 'send_failed'
  | 'engineer_review'
  | 'engineer_approved'
  | 'cert_sending'
  | 'certified'
  | 'cert_failed';
export type Action = 'submit' | 'return' | 'approve' | 'reopen' | 'retry' | 'edit' | 'engineer_approve' | 'engineer_return' | 'issue' | 'cert_retry';
export type Role = 'admin' | 'inspector' | 'engineer';

// from -> action -> next status; roles allowed per action
const NEXT: Record<Action, Partial<Record<Status, Status>>> = {
  submit: { draft: 'submitted', returned: 'submitted' },
  return: { submitted: 'returned' },
  approve: { submitted: 'sending' },
  reopen: { emailed: 'submitted' },
  retry: { send_failed: 'sending' },
  edit: { draft: 'draft', returned: 'returned', submitted: 'submitted' },
  engineer_approve: { engineer_review: 'engineer_approved' },
  engineer_return: { engineer_review: 'submitted' },
  issue: { engineer_approved: 'cert_sending' },
  cert_retry: { cert_failed: 'cert_sending' },
};

const ENGINEER_ACTIONS: Action[] = ['engineer_approve', 'engineer_return'];

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
  if (ENGINEER_ACTIONS.includes(action)) return role === 'engineer' ? NEXT[action][from] ?? null : null;
  if (action === 'edit') {
    if (role === 'engineer') return null;
    const ok = role === 'admin' ? from === 'submitted' : from === 'draft' || from === 'returned';
    return ok ? NEXT.edit[from] ?? null : null;
  }
  if (action === 'submit') return role === 'engineer' ? null : NEXT.submit[from] ?? null;
  if (role !== 'admin') return null;
  if (action === 'retry' && from === 'emailed') return mailLogged ? 'sending' : null;
  if (action === 'retry' && from === 'sending') return updatedAt && now - updatedAt.getTime() > STUCK_MS ? 'sending' : null;
  if (action === 'cert_retry' && from === 'cert_sending') return updatedAt && now - updatedAt.getTime() > STUCK_MS ? 'cert_sending' : null;
  return NEXT[action][from] ?? null;
}
