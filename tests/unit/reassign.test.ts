import { describe, expect, it } from 'vitest';
import { reassignCheck } from '../../shared/reassign';

const target = { id: 'b', role: 'inspector' as const, active: true };

describe('reassignCheck', () => {
  it('allows draft, returned and submitted', () => {
    for (const status of ['draft', 'returned', 'submitted'] as const) {
      expect(reassignCheck({ status, fromId: 'a', target })).toEqual({ ok: true });
    }
  });

  it('blocks sent statuses with 409', () => {
    for (const status of ['approved', 'sending', 'emailed', 'send_failed'] as const) {
      expect(reassignCheck({ status, fromId: 'a', target })).toEqual({ ok: false, status: 409, error: 'לא ניתן לשייך טופס שכבר נשלח' });
    }
  });

  it('rejects a missing, inactive or admin target', () => {
    for (const t of [null, { ...target, active: false }, { ...target, role: 'admin' as const }]) {
      const r = reassignCheck({ status: 'draft', fromId: 'a', target: t });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it('rejects the same inspector', () => {
    const r = reassignCheck({ status: 'submitted', fromId: 'b', target });
    expect(r).toEqual({ ok: false, status: 400, error: 'הטופס כבר משויך לבודק הזה' });
  });
});
