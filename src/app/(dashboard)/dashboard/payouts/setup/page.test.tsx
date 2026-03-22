// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockUseQuery = vi.fn();
const mockUseSearchParams = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockLoadConnectAndInitialize = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: unknown) => mockUseQuery(config),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('@stripe/connect-js/pure', () => ({
  loadConnectAndInitialize: (...args: unknown[]) => mockLoadConnectAndInitialize(...args),
}));

vi.mock('@stripe/react-connect-js', () => ({
  ConnectAccountManagement: () => <div data-testid="connect-account-management" />,
  ConnectAccountOnboarding: () => <div data-testid="connect-account-onboarding" />,
  ConnectBalances: () => <div data-testid="connect-balances" />,
  ConnectComponentsProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="connect-provider">{children}</div>
  ),
  ConnectNotificationBanner: () => <div data-testid="connect-notification-banner" />,
  ConnectPayouts: () => <div data-testid="connect-payouts" />,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

import PayoutsSetupPage from './page';

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
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
  mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
    const key = config?.queryKey?.[0];

    if (key === 'connect-payouts') {
      return {
        data: buildConnectData(),
        isLoading: false,
        refetch: vi.fn(),
      };
    }

    return { data: undefined, isLoading: false };
  });

  mockLoadConnectAndInitialize.mockReturnValue({ id: 'connect_instance' });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to create Stripe Connect session' }),
    })
  );
});

describe('PayoutsSetupPage', () => {
  it('shows a normal hosted setup button instead of the embedded onboarding form when setup is incomplete', async () => {
    render(<PayoutsSetupPage />);

    expect(
      screen.getByRole('button', { name: /start secure setup/i })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('connect-provider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-account-onboarding')).not.toBeInTheDocument();
    expect(mockLoadConnectAndInitialize).not.toHaveBeenCalled();
  });

  it('shows a clean error if the hosted setup link cannot be created', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'Failed to create Stripe onboarding link',
        }),
      })
    );

    render(<PayoutsSetupPage />);
    fireEvent.click(screen.getByRole('button', { name: /start secure setup/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create stripe onboarding link/i)).toBeInTheDocument();
    });
  });

  it('shows embedded payout management only after onboarding is complete', async () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'connect-payouts') {
        return {
          data: buildConnectData({
            onboardingComplete: true,
            readyForPaidDeals: true,
            payoutsEnabled: true,
            chargesEnabled: true,
            detailsSubmitted: true,
          }),
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Failed to create Stripe Connect session' }),
      })
    );

    render(<PayoutsSetupPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to create stripe connect session/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /start secure setup/i })).not.toBeInTheDocument();
    expect(mockLoadConnectAndInitialize).not.toHaveBeenCalled();
  });

  it('shows friendly business tasks instead of raw Stripe requirement keys', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'connect-payouts') {
        return {
          data: buildConnectData({
            requirements: {
              currentlyDue: [
                'business_profile.mcc',
                'business_profile.product_description',
                'business_profile.support_phone',
                'external_account',
                'representative.email',
              ],
              eventuallyDue: [],
              pastDue: [],
              pendingVerification: [],
              disabledReason: 'requirements.past_due',
            },
          }),
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsSetupPage />);

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

  it('explains what is still missing when Stripe returns but setup is incomplete', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('stripe_onboarding=return'));
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'connect-payouts') {
        return {
          data: buildConnectData({
            requirements: {
              currentlyDue: ['external_account', 'tos_acceptance.date', 'tos_acceptance.ip'],
              eventuallyDue: [],
              pastDue: ['external_account', 'tos_acceptance.date', 'tos_acceptance.ip'],
              pendingVerification: [],
              disabledReason: 'requirements.past_due',
            },
          }),
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsSetupPage />);

    expect(screen.getByRole('button', { name: /continue secure setup/i })).toBeInTheDocument();
    expect(
      screen.getByText(/we rechecked stripe when you came back to clientific/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/stripe still needs the payout terms accepted before paid deals can go live/i)
    ).toBeInTheDocument();
  });

  it('shows pending fund reasons in the setup sidebar', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'connect-payouts') {
        return {
          data: buildConnectData({
            onboardingComplete: false,
            readyForPaidDeals: false,
            payoutsEnabled: false,
            chargesEnabled: false,
            detailsSubmitted: false,
            balances: {
              available: [{ amount: 5000, currency: 'usd' }],
              pending: [{ amount: 1250, currency: 'usd' }],
            },
            referralPayouts: {
              lifetimeEarned: 3200,
              pendingTransfer: 870,
              transferredToConnect: 2330,
              pendingCount: 1,
              transferredCount: 2,
              lastTransferredAt: null,
            },
          }),
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsSetupPage />);

    expect(screen.getByText(/funds status/i)).toBeInTheDocument();
    expect(screen.getByText(/recent deal payments/i)).toBeInTheDocument();
    expect(screen.getByText(/referral earnings waiting on payout setup/i)).toBeInTheDocument();
  });
});
