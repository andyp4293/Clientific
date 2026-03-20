// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';

const mockSignIn = vi.fn();
const mockUseSession = vi.fn();
const mockAssign = vi.fn();
const mockReplace = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

describe('Login page verification actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
    mockSignIn.mockResolvedValue({ error: 'Invalid credentials' });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        assign: mockAssign,
        replace: mockReplace,
      },
    });
  });

  it('redirects authenticated users into the dashboard gate with a full-page redirect', async () => {
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      data: {
        user: {
          onboardingComplete: false,
        },
      },
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
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

  it('starts a full-page dashboard navigation after successful login', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: true });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith('/dashboard');
    });

    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
  });
});
