// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AddressAutocomplete from './AddressAutocomplete';

describe('AddressAutocomplete', () => {
  it('forwards manual typing so forms can persist real street edits', () => {
    const onInputChange = vi.fn();

    render(
      <AddressAutocomplete
        value=""
        onInputChange={onInputChange}
        onAddressSelect={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your address/i), {
      target: { value: '456 Broad St' },
    });

    expect(onInputChange).toHaveBeenCalledWith('456 Broad St');
  });
});
