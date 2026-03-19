// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockUseQuery = vi.fn();
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

import PayoutsPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
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
        data: {
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
        },
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

describe('PayoutsPage', () => {
  it('shows a clean retryable error when Stripe setup session creation fails', async () => {
    render(<PayoutsPage />);

    fireEvent.click(screen.getByRole('button', { name: /set up payouts/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create stripe connect session/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/secure stripe setup could not be opened yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('connect-provider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-account-onboarding')).not.toBeInTheDocument();
    expect(mockLoadConnectAndInitialize).not.toHaveBeenCalled();
  });

  it('shows a non-retryable live-mode blocker when Stripe rejects embedded onboarding setup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error:
            'Secure payout setup is temporarily unavailable while we finish a required Stripe review for live payouts.',
          retryable: false,
          code: 'platform_profile_incomplete',
        }),
      })
    );

    render(<PayoutsPage />);

    fireEvent.click(screen.getByRole('button', { name: /set up payouts/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/finish a required stripe review for live payouts/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/live payout access is being finalized/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('connect-provider')).not.toBeInTheDocument();
    expect(mockLoadConnectAndInitialize).not.toHaveBeenCalled();
  });
});
