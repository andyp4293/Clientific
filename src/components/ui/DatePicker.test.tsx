// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('renders placeholder when value is null', () => {
    render(<DatePicker value={null} onChange={vi.fn()} placeholder="Select birthday" />);

    expect(screen.getByRole('button', { name: /select birthday/i })).toBeInTheDocument();
  });

  it('calls onChange when selecting a date from the calendar', () => {
    const onChange = vi.fn();
    const selected = new Date(2026, 2, 9);
    const selectedLabel = selected.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    render(<DatePicker value={selected} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: selectedLabel }));
    fireEvent.click(screen.getByRole('button', { name: '15' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const pickedDate = onChange.mock.calls[0][0] as Date;
    expect(pickedDate.getFullYear()).toBe(2026);
    expect(pickedDate.getMonth()).toBe(2);
    expect(pickedDate.getDate()).toBe(15);
  });

  it('shows Clear and calls onClear when enabled', () => {
    const onClear = vi.fn();
    const value = new Date(2026, 2, 9);
    const selectedLabel = value.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    render(<DatePicker value={value} onChange={vi.fn()} allowClear onClear={onClear} />);

    fireEvent.click(screen.getByRole('button', { name: selectedLabel }));
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
