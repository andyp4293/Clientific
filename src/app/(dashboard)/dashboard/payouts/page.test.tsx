// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: unknown) => mockUseQuery(config),
}));

import PayoutsPage from './page';

const buildConnectData = (overrides: Record<string, unknown> = {}) => ({
  notConnected: true,
  accountId: null,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  onboardingComplete: false,
  readyForPaidDeals: false,
  bankAccountConnected: false,
  externalAccount: null,
  payoutSchedule: null,
  requirements: {
    currentlyDue: [],
    eventuallyDue: [],
    pastDue: [],
    pendingVerification: [],
    disabledReason: null,
  },
  balances: null,
  payouts: [],
  referralPayouts: {
    lifetimeEarned: 0,
    pendingTransfer: 0,
    transferredToConnect: 0,
    pendingCount: 0,
    transferredCount: 0,
    lastTransferredAt: null,
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
    const key = config?.queryKey?.[0];

    if (key === 'deal-earnings') {
      return {
        data: {
          transactions: [],
          totals: {
            totalGross: 0,
            totalFees: 0,
            totalNet: 0,
            transactionCount: 0,
          },
        },
        isLoading: false,
      };
    }

    if (key === 'connect-payouts') {
      return {
        data: buildConnectData(),
        isLoading: false,
      };
    }

    return { data: undefined, isLoading: false };
  });
});

describe('PayoutsPage', () => {
  it('sends the primary setup CTA to the dedicated setup page', () => {
    render(<PayoutsPage />);

    const link = screen.getByRole('link', { name: /set up payouts/i });
    expect(link).toHaveAttribute('href', '/dashboard/payouts/setup');
  });

  it('sends the next-step CTA to the dedicated setup page instead of expanding inline', () => {
    render(<PayoutsPage />);

    const link = screen.getByRole('link', { name: /open setup/i });
    expect(link).toHaveAttribute('href', '/dashboard/payouts/setup');
    expect(
      screen.queryByText(/manage payout setup and payout preferences/i)
    ).not.toBeInTheDocument();
  });

  it('shows friendly setup tasks instead of raw Stripe field names', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: {
            transactions: [],
            totals: {
              totalGross: 0,
              totalFees: 0,
              totalNet: 0,
              transactionCount: 0,
            },
          },
          isLoading: false,
        };
      }

      if (key === 'connect-payouts') {
        return {
          data: buildConnectData({
            requirements: {
              currentlyDue: [
                'business_profile.mcc',
                'business_profile.support_phone',
                'external_account',
                'representative.dob.day',
              ],
              eventuallyDue: [],
              pastDue: [],
              pendingVerification: [],
              disabledReason: 'requirements.past_due',
            },
          }),
          isLoading: false,
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByText(/complete business details/i)).toBeInTheDocument();
    expect(screen.getByText(/add customer support contact details/i)).toBeInTheDocument();
    expect(screen.getByText(/connect a bank account for payouts/i)).toBeInTheDocument();
    expect(screen.getByText(/verify the account owner identity/i)).toBeInTheDocument();
    expect(
      screen.getByText(/stripe still does not have a payout bank account saved for this account/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/stripe has paused paid payouts/i)).toBeInTheDocument();
    expect(screen.queryByText(/business profile mcc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/requirements\.past_due/i)).not.toBeInTheDocument();
  });

  it('shows that Stripe has not saved a bank account yet when setup is still incomplete', () => {
    render(<PayoutsPage />);

    expect(
      screen.getByText(/stripe has not saved a payout bank account yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/keep going in secure setup until stripe confirms the payout account back to clientific/i)
    ).toBeInTheDocument();
  });

  it('explains when referral earnings are waiting on payout setup', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: {
            transactions: [],
            totals: {
              totalGross: 0,
              totalFees: 0,
              totalNet: 0,
              transactionCount: 0,
            },
          },
          isLoading: false,
        };
      }

      if (key === 'connect-payouts') {
        return {
          data: buildConnectData({
            referralPayouts: {
              lifetimeEarned: 3240,
              pendingTransfer: 870,
              transferredToConnect: 2370,
              pendingCount: 1,
              transferredCount: 1,
              lastTransferredAt: '2026-03-10T12:00:00.000Z',
            },
          }),
          isLoading: false,
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByText(/referral payouts/i)).toBeInTheDocument();
    expect(screen.getByText(/\$8\.70 is waiting for you to finish stripe payout setup/i)).toBeInTheDocument();
    expect(screen.getByText(/referral earnings waiting on payout setup/i)).toBeInTheDocument();
    expect(
      screen.getByText(/finish payout setup so clientific can move them into your stripe payout balance/i)
    ).toBeInTheDocument();
  });

  it('explains when recent deal payments are still clearing through Stripe', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: {
            transactions: [],
            totals: {
              totalGross: 0,
              totalFees: 0,
              totalNet: 0,
              transactionCount: 0,
            },
          },
          isLoading: false,
        };
      }

      if (key === 'connect-payouts') {
        return {
          data: buildConnectData({
            onboardingComplete: true,
            readyForPaidDeals: true,
            payoutsEnabled: true,
            chargesEnabled: true,
            detailsSubmitted: true,
            balances: {
              available: [{ amount: 5000, currency: 'usd' }],
              pending: [{ amount: 1250, currency: 'usd' }],
            },
          }),
          isLoading: false,
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByText(/why funds are pending/i)).toBeInTheDocument();
    expect(screen.getByText(/recent deal payments/i)).toBeInTheDocument();
    expect(
      screen.getByText(/these payments are still clearing through stripe before they move into your available balance/i)
    ).toBeInTheDocument();
  });

  it('uses the more professional Stripe disclosure copy', () => {
    render(<PayoutsPage />);

    expect(
      screen.getByText(/clientific uses stripe to securely handle business verification, subscription billing, and payouts/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/secure payments and payouts/i)).toBeInTheDocument();
    expect(screen.queryByText(/payouts powered by stripe/i)).not.toBeInTheDocument();
  });
});
