// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterPage from './page';

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

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
    mockSignIn.mockResolvedValue(undefined);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verificationEmailSent: true }),
      } as Response);
  });

  it('uses a minimal business step and moves the rest of setup into onboarding', async () => {
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

    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business type/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/business phone/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/street address/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /business location/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: 'Test Salon' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await screen.findByRole('heading', { name: /check your email/i });
    expect(screen.getByText(/finish your phone and location setup inside the dashboard/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    const registerCall = vi.mocked(global.fetch).mock.calls[1];
    expect(registerCall?.[0]).toBe('/api/auth/register');

    const payload = JSON.parse((registerCall?.[1] as RequestInit).body as string);
    expect(payload).toMatchObject({
      email: 'owner@example.com',
      businessName: 'Test Salon',
      businessType: 'Salon',
    });
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('street');
    expect(payload).not.toHaveProperty('city');
    expect(payload).not.toHaveProperty('state');
    expect(payload).not.toHaveProperty('zipCode');
    expect(payload).not.toHaveProperty('country');
  });
});
