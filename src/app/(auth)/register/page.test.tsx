// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterPage from './page';

const mockPush = vi.fn();
const mockSignIn = vi.fn();
const mockUseSession = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

describe('Register page location step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
    mockSignIn.mockResolvedValue(undefined);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true }),
    } as Response);
  });

  it('does not render a visible timezone field in Business Location step', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password \*/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

    await screen.findByRole('heading', { name: /tell us about your business/i });

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: 'Test Salon' },
    });
    fireEvent.change(screen.getByLabelText(/business phone/i), {
      target: { value: '(555) 123-4567' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));

    await screen.findByRole('heading', { name: /business location/i });

    expect(screen.queryByLabelText(/timezone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/using your browser timezone/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/check-email',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
