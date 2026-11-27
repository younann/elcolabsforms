import { describe, expect, it } from 'vitest';
import { dispositionName } from '../../src/lib/share';

describe('dispositionName', () => {
  it('prefers the UTF-8 name', () => {
    const h = `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent('דוח בדיקה')}.pdf`;
    expect(dispositionName(h, 'x.pdf')).toBe('דוח בדיקה.pdf');
  });

  it('falls back to the plain name, then the default', () => {
    expect(dispositionName('attachment; filename="report.pdf"', 'x.pdf')).toBe('report.pdf');
    expect(dispositionName(null, 'x.pdf')).toBe('x.pdf');
    expect(dispositionName("attachment; filename*=UTF-8''%E0%A4%A", 'x.pdf')).toBe('x.pdf');
  });
});
