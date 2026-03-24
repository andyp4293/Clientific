// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomSelect } from './CustomSelect';

describe('CustomSelect', () => {
  it('filters searchable options by name substring anywhere in the label', () => {
    render(
      <CustomSelect
        value=""
        onChange={vi.fn()}
        placeholder="Select customer…"
        searchable
        searchPlaceholder="Search by name or phone"
        options={[
          { value: 'cust-1', label: 'Timothy Jones · 5551112222' },
          { value: 'cust-2', label: 'Betty Timms · 5553334444' },
          { value: 'cust-3', label: 'Samantha Johnson · 5557778888' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select customer/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /search by name or phone/i }), {
      target: { value: 'tim' },
    });

    expect(screen.getByRole('option', { name: /timothy jones/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /betty timms/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /samantha johnson/i })).not.toBeInTheDocument();
  });

  it('filters searchable options by continuous phone digits anywhere in the label', () => {
    render(
      <CustomSelect
        value=""
        onChange={vi.fn()}
        placeholder="Select customer…"
        searchable
        searchPlaceholder="Search by name or phone"
        options={[
          { value: 'cust-1', label: 'Jane Smith · (333) 123-9999' },
          { value: 'cust-2', label: 'Bob Brown · 5550001111' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select customer/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /search by name or phone/i }), {
      target: { value: '123' },
    });

    expect(screen.getByRole('option', { name: /jane smith/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /bob brown/i })).not.toBeInTheDocument();
  });
});
