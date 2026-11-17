import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildNotice, mailMode, sendMail } from '../../server/mail';
import { getForm } from '../../shared/forms';

const def = getForm('f1220');
const sub = { id: 'abc', siteName: 'אתר <1>', testNumber: 'T-9' } as never;

describe('mail', () => {
  afterEach(() => vi.restoreAllMocks());

  it('builds the notice subject and review link', () => {
    const n = buildNotice(sub, def, 'דני', 'https://app.example');
    expect(n.subject).toBe(`טופס ממתין לאישור – ${def.title} – אתר <1>`);
    expect(n.html).toContain('https://app.example/admin/review/abc');
    expect(n.html).toContain('דני');
    expect(n.html).not.toContain('<1>');
  });

  it('logs instead of sending in log mode', async () => {
    vi.stubEnv('MAIL_MODE', 'log');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await sendMail({ to: 'a@b.co', subject: 's', html: '<p>x</p>' })).toEqual({ logged: true });
    expect(log).toHaveBeenCalled();
    expect(mailMode()).toBe('log');
    vi.stubEnv('MAIL_MODE', 'smtp');
    expect(mailMode()).toBe('live');
    vi.unstubAllEnvs();
  });
});
