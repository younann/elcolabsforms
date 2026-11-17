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
});
