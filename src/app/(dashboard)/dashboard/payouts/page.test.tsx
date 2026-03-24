// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseQuery = vi.fn();
const mockUseSearchParams = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: unknown) => mockUseQuery(config),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('@/components/payouts/EmbeddedPayoutWorkspace', async () => {
  const actual = await vi.importActual<typeof import('@/components/payouts/EmbeddedPayoutWorkspace')>(
    '@/components/payouts/EmbeddedPayoutWorkspace'
  );

  return {
    ...actual,
    EmbeddedPayoutWorkspace: ({
      visible,
      onboardingComplete,
    }: {
      visible: boolean;
      onboardingComplete: boolean;
    }) =>
      visible ? (
        <div data-testid="embedded-payout-workspace">
          {onboardingComplete ? 'live payout workspace' : 'setup workspace'}
        </div>
      ) : null,
  };
});

import PayoutsPage from './page';

const buildConnectData = (overrides: Record<string, unknown> = {}) => ({
  notConnected: true,
  accountId: null,
  businessType: 'Salon',
  isReferralOnly: false,
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
  dealPayouts: {
    lifetimeEarned: 0,
    pendingTransfer: 0,
    transferredToConnect: 0,
    pendingCount: 0,
    transferredCount: 0,
    automaticCount: 0,
    lastTransferredAt: null,
  },
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
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
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
        refetch: vi.fn(),
      };
    }

    return { data: undefined, isLoading: false };
  });
});

describe('PayoutsPage', () => {
  it('uses the full desktop page shell', () => {
    render(<PayoutsPage />);

    const page = screen.getByTestId('payouts-page');
    expect(page).toHaveClass('w-full');
    expect(page).not.toHaveClass('max-w-7xl');
  });

  it('keeps payout setup on the main payouts page when setup is incomplete', () => {
    render(<PayoutsPage />);

    expect(screen.getByRole('button', { name: /start secure setup/i })).toBeInTheDocument();
    expect(screen.getByText(/connect payouts without leaving this page/i)).toBeInTheDocument();
    expect(screen.queryByTestId('embedded-payout-workspace')).not.toBeInTheDocument();
  });

  it('shows the live embedded payout workspace directly on the payouts page', () => {
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
            externalAccount: {
              id: 'ba_123',
              bankName: 'Santander',
              last4: '7290',
              routingNumberLast4: '0000',
              accountHolderName: 'ABC Nails',
              status: 'verified',
            },
            payoutSchedule: {
              interval: 'manual',
              monthlyPayoutDays: [],
              weeklyPayoutDays: [],
              statementDescriptor: null,
            },
          }),
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByText(/see what can pay out from your deal sales first/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /keep your deal revenue and payout progress in one place/i })).toBeInTheDocument();
    expect(screen.getByTestId('embedded-payout-workspace')).toBeInTheDocument();
    expect(screen.queryByText(/funds status/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start secure setup/i })).not.toBeInTheDocument();
  });

  it('keeps businesses focused on deal payouts before referral details', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: {
            transactions: [],
            totals: {
              totalGross: 152,
              totalFees: 24,
              totalNet: 128,
              transactionCount: 2,
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
            dealPayouts: {
              lifetimeEarned: 128,
              pendingTransfer: 0,
              transferredToConnect: 128,
              pendingCount: 0,
              transferredCount: 2,
              automaticCount: 2,
              lastTransferredAt: null,
            },
            referralPayouts: {
              lifetimeEarned: 0,
              pendingTransfer: 0,
              transferredToConnect: 0,
              pendingCount: 0,
              transferredCount: 0,
              lastTransferredAt: null,
            },
          }),
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByRole('heading', { name: /keep your deal revenue and payout progress in one place/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /deal transaction history/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /recurring referral earnings move into your stripe payout balance here/i })).not.toBeInTheDocument();
  });

  it('hides deal-only sections for referral-only accounts', () => {
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
            businessType: 'Referral Partner',
            isReferralOnly: true,
            onboardingComplete: true,
            readyForPaidDeals: true,
            payoutsEnabled: true,
            chargesEnabled: true,
            detailsSubmitted: true,
            referralPayouts: {
              lifetimeEarned: 4800,
              pendingTransfer: 1200,
              transferredToConnect: 3600,
              pendingCount: 1,
              transferredCount: 3,
              lastTransferredAt: null,
            },
          }),
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByText(/see what can pay out from referral earnings next/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /recurring referral earnings move into your stripe payout balance here/i })).toBeInTheDocument();
    expect(screen.queryByText(/deal payouts/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /deal transaction history/i })).not.toBeInTheDocument();
  });

  it('explains Stripe return state on the main payouts page when setup is still incomplete', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('stripe_onboarding=return'));
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
              currentlyDue: ['external_account', 'tos_acceptance.date'],
              eventuallyDue: [],
              pastDue: ['external_account', 'tos_acceptance.date'],
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

    render(<PayoutsPage />);

    expect(screen.getByRole('button', { name: /continue secure setup/i })).toBeInTheDocument();
    expect(
      screen.getByText(/we rechecked stripe when you came back/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/stripe still needs the payout terms accepted before payouts can go live/i)
    ).toBeInTheDocument();
  });

  it('shows friendly payout tasks instead of raw Stripe field names', () => {
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
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByText(/complete payout profile details/i)).toBeInTheDocument();
    expect(screen.getByText(/add customer support contact details/i)).toBeInTheDocument();
    expect(screen.getByText(/connect a bank account for payouts/i)).toBeInTheDocument();
    expect(screen.getByText(/verify the payout owner identity/i)).toBeInTheDocument();
    expect(screen.queryByText(/business profile mcc/i)).not.toBeInTheDocument();
  });

  it('uses the more professional Stripe disclosure copy', () => {
    render(<PayoutsPage />);

    expect(
      screen.getByText(/clientific uses stripe to securely handle payout verification, deal payouts, subscription billing, and payouts/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/secure payments and payouts/i)).toBeInTheDocument();
    expect(screen.queryByText(/payouts powered by stripe/i)).not.toBeInTheDocument();
  });
});
