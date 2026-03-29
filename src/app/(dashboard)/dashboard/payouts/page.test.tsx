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
  businessName: 'ABC Nails',
  businessEmail: 'andyp4293@gmail.com',
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

const buildEarningsData = (overrides: Record<string, unknown> = {}) => ({
  entries: [],
  totals: {
    dealGross: 0,
    dealFees: 0,
    dealNet: 0,
    dealCount: 0,
    referralNet: 0,
    referralCount: 0,
    totalNet: 0,
    entryCount: 0,
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
        data: buildEarningsData(),
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
  it('shows a full-page loading shell while payout data is still resolving', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: undefined,
          isLoading: true,
        };
      }

      if (key === 'connect-payouts') {
        return {
          data: undefined,
          isLoading: true,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByTestId('payouts-page-loading')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start secure setup/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/finish payout setup/i)).not.toBeInTheDocument();
  });

  it('uses the full desktop page shell', () => {
    render(<PayoutsPage />);

    const page = screen.getByTestId('payouts-page');
    expect(page).toHaveClass('w-full');
    expect(page).not.toHaveClass('max-w-7xl');
  });

  it('keeps payout setup on the main payouts page when setup is incomplete', () => {
    render(<PayoutsPage />);

    expect(screen.getByRole('button', { name: /start secure setup/i })).toBeInTheDocument();
    expect(screen.getByText(/finish payout setup/i)).toBeInTheDocument();
    expect(screen.getByText(/current business:/i)).toBeInTheDocument();
    expect(screen.getByText(/abc nails/i)).toBeInTheDocument();
    expect(screen.queryByText(/^after setup$/i)).not.toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.queryByText(/^available now$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^still pending$/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('embedded-payout-workspace')).not.toBeInTheDocument();
  });

  it('shows the live embedded payout workspace directly on the payouts page', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: buildEarningsData(),
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
              available: [{ amount: 128, currency: 'usd' }],
              pending: [{ amount: 500, currency: 'usd' }],
            },
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

    expect(
      screen.getByRole('heading', { name: /manage payouts immediately/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /payout balances and schedule/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('embedded-payout-workspace')).toBeInTheDocument();
    expect(screen.getByText(/earnings history/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start secure setup/i })).not.toBeInTheDocument();
  });

  it('shows combined earnings totals and history for deals and referrals', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: buildEarningsData({
            entries: [
              {
                id: 'deal_1',
                kind: 'deal',
                sourceName: 'Spring Facial',
                detailLabel: 'Jane Doe',
                detailPhone: '+15551234567',
                occurredAt: '2026-03-20T10:00:00.000Z',
                grossAmount: 4000,
                feeAmount: 600,
                netAmount: 3400,
                status: 'paid',
              },
              {
                id: 'ref_1',
                kind: 'referral',
                sourceName: 'Glow Spa',
                detailLabel: 'billing@glowspa.com',
                detailPhone: null,
                occurredAt: '2026-03-21T10:00:00.000Z',
                grossAmount: 1250,
                feeAmount: 0,
                netAmount: 1250,
                status: 'transferred',
              },
            ],
            totals: {
              dealGross: 4000,
              dealFees: 600,
              dealNet: 3400,
              dealCount: 1,
              referralNet: 1250,
              referralCount: 1,
              totalNet: 4650,
              entryCount: 2,
            },
          }),
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
          }),
          isLoading: false,
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(screen.getByText(/deal earnings/i)).toBeInTheDocument();
    expect(screen.getByText(/referral earnings/i)).toBeInTheDocument();
    expect(screen.getByText(/total earnings/i)).toBeInTheDocument();
    expect(screen.getByText(/spring facial/i)).toBeInTheDocument();
    expect(screen.getByText(/glow spa/i)).toBeInTheDocument();
    expect(screen.getByText(/^deal$/i)).toBeInTheDocument();
    expect(screen.getByText(/^referral$/i)).toBeInTheDocument();
    expect(screen.getByText(/moved to stripe/i)).toBeInTheDocument();
  });

  it('keeps the combined earnings view for referral-only accounts', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: buildEarningsData({
            totals: {
              dealGross: 0,
              dealFees: 0,
              dealNet: 0,
              dealCount: 0,
              referralNet: 4800,
              referralCount: 3,
              totalNet: 4800,
              entryCount: 3,
            },
          }),
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

    expect(screen.getByText(/track recorded referral commissions in one place/i)).toBeInTheDocument();
    expect(screen.getByText(/earnings history/i)).toBeInTheDocument();
    expect(screen.queryByText(/deal transaction history/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/deal payouts/i)).not.toBeInTheDocument();
  });

  it('explains Stripe return state on the main payouts page when setup is still incomplete', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('stripe_onboarding=return'));
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: buildEarningsData(),
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
    expect(screen.getByText(/we rechecked stripe when you came back/i)).toBeInTheDocument();
    expect(
      screen.getByText(/stripe still needs the payout terms accepted before payouts can go live/i)
    ).toBeInTheDocument();
  });

  it('calls out the final Stripe agreement step when the bank account is already saved', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('stripe_onboarding=return'));
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: buildEarningsData(),
          isLoading: false,
        };
      }

      if (key === 'connect-payouts') {
        return {
          data: buildConnectData({
            externalAccount: {
              id: 'ba_123',
              bankName: 'Bank of America',
              last4: '1080',
              routingNumberLast4: '0000',
              accountHolderName: 'Jackson Nails',
              status: 'verified',
            },
            requirements: {
              currentlyDue: ['tos_acceptance.date', 'tos_acceptance.ip'],
              eventuallyDue: [],
              pastDue: ['tos_acceptance.date', 'tos_acceptance.ip'],
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

    expect(
      screen.getByRole('button', { name: /resume final stripe confirmation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /finish stripe's final confirmation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /stripe saved your bank account, but the final stripe agreement was not submitted yet/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /the last step is accepting stripe's connected account agreement on the final review screen/i
      )
    ).toBeInTheDocument();
  });

  it('shows friendly payout tasks instead of raw Stripe field names', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: buildEarningsData(),
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
      screen.getByText(
        /clientific uses stripe to securely handle payout verification, deal payouts, subscription billing, and payouts/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/secure payments and payouts/i)).toBeInTheDocument();
    expect(screen.queryByText(/payouts powered by stripe/i)).not.toBeInTheDocument();
  });

  it('shows a payout status error instead of pretending setup is incomplete when the API fails', () => {
    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deal-earnings') {
        return {
          data: buildEarningsData(),
          isLoading: false,
        };
      }

      if (key === 'connect-payouts') {
        return {
          data: undefined,
          isLoading: false,
          error: new Error('Failed to load payout data'),
          refetch: vi.fn(),
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<PayoutsPage />);

    expect(
      screen.getByRole('heading', {
        name: /clientific could not verify the live stripe payout status just now/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry payout status/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start secure setup/i })).not.toBeInTheDocument();
  });
});
