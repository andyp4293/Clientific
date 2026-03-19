// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
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
  it('shows a clean retryable error when Stripe setup session creation fails', async () => {
    render(<PayoutsSetupPage />);

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

    render(<PayoutsSetupPage />);

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
    expect(screen.getByText(/stripe has paused paid payouts/i)).toBeInTheDocument();
    expect(screen.queryByText(/business profile mcc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/requirements\.past_due/i)).not.toBeInTheDocument();
  });
});
