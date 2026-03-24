// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockGetServerSession = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const mockGetSubscriptionInfo = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/lib/subscription', () => ({
  getSubscriptionInfo: (...args: unknown[]) => mockGetSubscriptionInfo(...args),
}));

vi.mock('@/components/billing/UpgradePricingCards', () => ({
  UpgradePricingCards: ({
    status,
    trialExpired,
    hasStripeCustomer,
  }: {
    status: string;
    trialExpired: boolean;
    hasStripeCustomer: boolean;
  }) => (
    <div
      data-testid="pricing-cards"
      data-status={status}
      data-trial-expired={String(trialExpired)}
      data-has-stripe-customer={String(hasStripeCustomer)}
    >
      Pricing cards
    </div>
  ),
}));

import SubscribePage from './page';

describe('SubscribePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'biz-1',
        businessId: 'biz-1',
      },
    });
  });

  it('renders the expired trial paywall when subscription info is available', async () => {
    mockGetSubscriptionInfo.mockResolvedValue({
      subscriptionStatus: 'trialing',
      stripeCustomerId: 'cus_123',
      trialDaysRemaining: 0,
    });

    render(await SubscribePage());

    expect(screen.getByText(/your free trial has ended/i)).toBeInTheDocument();
    expect(screen.getByText(/pick starter, pro, or premium from \$39\/month/i)).toBeInTheDocument();
    expect(screen.getByTestId('pricing-cards')).toHaveAttribute('data-status', 'trialing');
    expect(screen.getByTestId('pricing-cards')).toHaveAttribute('data-trial-expired', 'true');
    expect(screen.getByTestId('pricing-cards')).toHaveAttribute('data-has-stripe-customer', 'true');
  });

  it('falls back to a generic paywall when billing data cannot be loaded', async () => {
    mockGetSubscriptionInfo.mockRejectedValue(new Error('Can\'t reach database server'));

    render(await SubscribePage());

    expect(screen.getByText(/subscription required/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a plan from \$39\/month/i)).toBeInTheDocument();
    expect(screen.getByTestId('pricing-cards')).toHaveAttribute('data-status', 'inactive');
    expect(screen.getByTestId('pricing-cards')).toHaveAttribute('data-trial-expired', 'false');
  });
});
