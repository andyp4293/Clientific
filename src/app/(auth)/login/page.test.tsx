// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignIn = vi.fn();
const mockUseSession = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

describe('Login page verification actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
    mockSignIn.mockResolvedValue({ error: 'Invalid credentials' });
  });

  it('does not show resend verification button by default', () => {
    render(<LoginPage />);
    expect(
      screen.queryByRole('button', { name: /resend verification code/i })
    ).not.toBeInTheDocument();
  });

  it('shows resend verification button only after EmailNotVerified login result', async () => {
    mockSignIn.mockResolvedValueOnce({ error: 'EmailNotVerified' });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'owner@example.com',
        password: 'Password123!',
        redirect: false,
      });
    });

    expect(
      await screen.findByRole('button', { name: /resend verification code/i })
    ).toBeInTheDocument();
  });
});
