// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InspectorPicker } from '../../src/ui';

afterEach(cleanup);

const options = [
  { id: '1', displayName: 'משה כהן', username: 'moshe' },
  { id: '2', displayName: 'דנה כץ', username: 'dana' },
  { id: '3', displayName: 'יוסף פרץ', username: 'yossi' },
];

describe('InspectorPicker', () => {
  test('combobox with ranked listbox', () => {
    render(<InspectorPicker label="בודק" options={options} value="" onChange={() => {}} />);
    const box = screen.getByRole('combobox', { name: 'בודק' });
    expect(box).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'כצ' } });
    expect(box).toHaveAttribute('aria-expanded', 'true');
    const opts = screen.getAllByRole('option');
    expect(opts[0]).toHaveTextContent('דנה כץ');
  });

  test('arrow keys and enter choose', () => {
    const onChange = vi.fn();
    render(<InspectorPicker label="בודק" options={options} value="" onChange={onChange} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(box.getAttribute('aria-activedescendant')).toContain('opt-3');
    fireEvent.keyDown(box, { key: 'Enter' });
    // sorted by name: דנה, יוסף, משה
    expect(onChange).toHaveBeenCalledWith(options[2]);
  });

  test('escape closes, click chooses', () => {
    const onChange = vi.fn();
    render(<InspectorPicker label="בודק" options={options} value="" onChange={onChange} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(box).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(box, { target: { value: 'משה' } });
    fireEvent.click(screen.getByRole('option', { name: /משה כהן/ }));
    expect(onChange).toHaveBeenCalledWith(options[0]);
  });

  test('shows the selected name and clears', () => {
    const onChange = vi.fn();
    render(<InspectorPicker label="בודק" options={options} value="3" clearable onChange={onChange} />);
    expect(screen.getByRole('combobox')).toHaveValue('יוסף פרץ');
    fireEvent.click(screen.getByRole('button', { name: 'ניקוי הבודק' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('excludes the current owner', () => {
    render(<InspectorPicker label="בודק" options={options} value="" inline excludeId="1" onChange={() => {}} />);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});
