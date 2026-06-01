// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BillingPage from './page';

const mockUseSession = vi.fn();
const mockToastError = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('Dashboard billing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      data: { user: { id: 'biz-1', email: 'owner@example.com' } },
    });
    global.fetch = vi.fn();
  });

  it('shows Apple-managed messaging and hides website portal actions for App Store subscriptions', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          subscriptionPlan: 'pro',
          subscriptionStatus: 'active',
          trialEndsAt: null,
          stripeCurrentPeriodEnd: null,
          trialDaysRemaining: null,
          isActive: true,
          billingProvider: 'app_store',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          paymentMethod: null,
          invoices: [],
        }),
      } as Response);

    render(<BillingPage />);

    await screen.findByRole('link', { name: /manage through apple/i });

    expect(
      screen.getByText(/manage this subscription where you bought it/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/clientific web billing does not control app store renewals/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/app store receipts stay available from apple for this subscription/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage through apple/i })).toHaveAttribute(
      'href',
      'https://support.apple.com/118428',
    );
    expect(
      screen.queryByRole('button', { name: /^manage subscription$/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add card/i })).not.toBeInTheDocument();
  });

  it('keeps website billing actions for Stripe-managed subscriptions', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          subscriptionPlan: 'starter',
          subscriptionStatus: 'active',
          trialEndsAt: null,
          stripeCurrentPeriodEnd: '2026-06-01T00:00:00.000Z',
          trialDaysRemaining: null,
          isActive: true,
          billingProvider: 'stripe',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          paymentMethod: {
            brand: 'visa',
            last4: '4242',
            expMonth: 12,
            expYear: 2030,
            funding: 'credit',
          },
          invoices: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/session_abc' }),
      } as Response);

    render(<BillingPage />);

    await screen.findByText(/managed on the web/i);

    expect(screen.getByTestId('current-auto-renewal-disclosure')).toHaveTextContent(
      'Clientific automatically charges $39/month plus applicable taxes until you cancel.',
    );
    expect(screen.getByTestId('current-auto-renewal-disclosure')).toHaveTextContent(
      'Your subscription renews monthly unless canceled before the next billing date.',
    );

    fireEvent.click(screen.getByRole('button', { name: /^manage subscription$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/billing/portal', { method: 'POST' });
    });

    expect(screen.queryByRole('link', { name: /manage through apple/i })).not.toBeInTheDocument();
  });
});
