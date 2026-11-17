import { describe, expect, it } from 'vitest';
import { normalizeName, rankInspectors } from '../../shared/inspector-rank';

const people = [
  { id: '1', displayName: 'משה כהן', username: 'moshe' },
  { id: '2', displayName: 'מיכל לוי', username: 'michal.l' },
  { id: '3', displayName: 'אברהם מזרחי', username: 'avi' },
  { id: '4', displayName: 'יוסף פרץ', username: 'yossi' },
  { id: '5', displayName: 'משה', username: 'moshe2' },
  { id: '6', displayName: 'דנה כץ', username: 'dana' },
];
const ids = (q: string) => rankInspectors(q, people).map((p) => p.id);

describe('normalizeName', () => {
  it('folds final letters, case and spaces', () => {
    expect(normalizeName('  אברהם   מזרחי ')).toBe('אברהמ מזרחי');
    expect(normalizeName('ךםןףץ')).toBe('כמנפצ');
    expect(normalizeName('MoShe')).toBe('moshe');
  });
});

describe('rankInspectors', () => {
  it('returns everyone sorted by name for an empty query', () => {
    expect(ids('')).toHaveLength(people.length);
    expect(ids('  ')[0]).toBe('3');
  });

  it('puts exact before prefix before substring', () => {
    expect(ids('משה')).toEqual(['5', '1']);
    expect(ids('כ')).toEqual(['6', '1', '2']);
  });

  it('matches username prefix', () => {
    expect(ids('yos')[0]).toBe('4');
    expect(ids('MICH')[0]).toBe('2');
  });

  it('matches a later word before a plain substring', () => {
    // word start "לוי" beats substring
    expect(ids('לו')[0]).toBe('2');
  });

  it('tolerates final letters', () => {
    expect(ids('אברהמ')[0]).toBe('3');
    expect(ids('פרצ')[0]).toBe('4');
    expect(ids('כצ')[0]).toBe('6');
  });

  it('tolerates missing and extra spaces', () => {
    expect(ids('משהכהן')[0]).toBe('1');
    expect(ids('דנה  כץ')[0]).toBe('6');
  });

  it('finds small typos', () => {
    expect(ids('מזרכי')[0]).toBe('3');
    expect(ids('יוסב פרץ')[0]).toBe('4');
    expect(ids('mosje')[0]).toBe('1');
  });

  it('drops unrelated names', () => {
    expect(ids('zzzz')).toEqual([]);
    expect(ids('קקקקק')).toEqual([]);
  });

  it('does not fuzz very short queries', () => {
    expect(ids('ש')).toEqual(['5', '1']);
  });
});
