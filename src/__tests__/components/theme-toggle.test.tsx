import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}));

import { ThemeToggle } from '@/components/ui/ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cycles light to dark', async () => {
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme });

    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: /light/i });
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('cycles dark to system', async () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: mockSetTheme });

    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: /dark/i });
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('cycles system to light', async () => {
    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: mockSetTheme });

    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: /system/i });
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});
