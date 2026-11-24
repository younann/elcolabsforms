import { describe, it, expect } from 'vitest';
import { canTransition } from '../../shared/status';

describe('canTransition', () => {
  it('allows valid transitions', () => {
    expect(canTransition('draft', 'submit', 'inspector')).toBe('submitted');
    expect(canTransition('returned', 'submit', 'inspector')).toBe('submitted');
    expect(canTransition('submitted', 'approve', 'admin')).toBe('sending');
    expect(canTransition('submitted', 'return', 'admin')).toBe('returned');
    expect(canTransition('emailed', 'reopen', 'admin')).toBe('submitted');
    expect(canTransition('send_failed', 'retry', 'admin')).toBe('sending');
    expect(canTransition('returned', 'edit', 'inspector')).not.toBeNull();
    expect(canTransition('submitted', 'edit', 'admin')).not.toBeNull();
  });
  it('rejects invalid transitions', () => {
    expect(canTransition('submitted', 'approve', 'inspector')).toBeNull();
    expect(canTransition('sending', 'approve', 'admin')).toBeNull();
    expect(canTransition('submitted', 'edit', 'inspector')).toBeNull();
    expect(canTransition('draft', 'approve', 'admin')).toBeNull();
    expect(canTransition('draft', 'reopen', 'admin')).toBeNull();
  });
  it('allows retry from a stuck sending state only', () => {
    const now = Date.now();
    expect(canTransition('sending', 'retry', 'admin')).toBeNull();
    expect(canTransition('sending', 'retry', 'admin', new Date(now - 60_000), now)).toBeNull();
    expect(canTransition('sending', 'retry', 'admin', new Date(now - 16 * 60_000), now)).toBe('sending');
    expect(canTransition('sending', 'retry', 'inspector', new Date(now - 16 * 60_000), now)).toBeNull();
  });
  it('allows retry from emailed only when the mail was only logged', () => {
    const now = Date.now();
    expect(canTransition('emailed', 'retry', 'admin')).toBeNull();
    expect(canTransition('emailed', 'retry', 'admin', new Date(now), now, false)).toBeNull();
    expect(canTransition('emailed', 'retry', 'admin', new Date(now), now, true)).toBe('sending');
    expect(canTransition('emailed', 'retry', 'inspector', new Date(now), now, true)).toBeNull();
  });
  it('engineer approves or returns only forms waiting for them', () => {
    expect(canTransition('engineer_review', 'engineer_approve', 'engineer')).toBe('engineer_approved');
    expect(canTransition('engineer_review', 'engineer_return', 'engineer')).toBe('submitted');
    expect(canTransition('engineer_review', 'engineer_approve', 'admin')).toBeNull();
    expect(canTransition('submitted', 'engineer_approve', 'engineer')).toBeNull();
    expect(canTransition('submitted', 'approve', 'engineer')).toBeNull();
    expect(canTransition('draft', 'submit', 'engineer')).toBeNull();
    expect(canTransition('submitted', 'edit', 'engineer')).toBeNull();
  });
  it('admin issues a certificate after the engineer and retries a failed one', () => {
    const now = Date.now();
    expect(canTransition('engineer_approved', 'issue', 'admin')).toBe('cert_sending');
    expect(canTransition('engineer_review', 'issue', 'admin')).toBeNull();
    expect(canTransition('engineer_approved', 'issue', 'engineer')).toBeNull();
    expect(canTransition('cert_failed', 'cert_retry', 'admin')).toBe('cert_sending');
    expect(canTransition('cert_sending', 'cert_retry', 'admin', new Date(now - 60_000), now)).toBeNull();
    expect(canTransition('cert_sending', 'cert_retry', 'admin', new Date(now - 16 * 60_000), now)).toBe('cert_sending');
  });
});
