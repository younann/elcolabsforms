// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Segmented, Sheet, StatusBadge, Toaster, toast } from '../../src/ui';

afterEach(cleanup);

function Answer() {
  const [v, setV] = useState<'ok' | 'bad' | 'na' | null>(null);
  return (
    <div dir="rtl">
      <Segmented
        label="תשובה"
        value={v}
        onChange={setV}
        options={[
          { value: 'ok', label: 'תקין', tone: 'success' },
          { value: 'bad', label: 'לא תקין', tone: 'danger' },
          { value: 'na', label: 'ב"י' },
        ]}
      />
    </div>
  );
}

describe('Segmented', () => {
  test('acts as a radio group', () => {
    render(<Answer />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'לא תקין' }));
    expect(screen.getByRole('radio', { name: 'לא תקין' })).toHaveAttribute('aria-checked', 'true');
  });

  test('arrow keys follow RTL order', () => {
    render(<Answer />);
    const first = screen.getByRole('radio', { name: 'תקין' });
    fireEvent.click(first);
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'לא תקין' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Sheet', () => {
  test('close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="חתימה">
        תוכן
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'סגירה', hidden: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('StatusBadge', () => {
  test('shows the Hebrew label', () => {
    render(<StatusBadge status="returned" />);
    expect(screen.getByText('הוחזר לתיקון')).toBeInTheDocument();
  });
});

describe('toast', () => {
  test('shows and auto-dismisses', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success('נשמר');
    });
    expect(screen.getByText('נשמר')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('נשמר')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
