import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    businessBankAccount: {
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/deal-payouts', () => ({
  emptyDealPayoutSummary: vi.fn(() => ({
    pendingTransfer: 0,
    transferredToConnect: 0,
  })),
  getDealPayoutSummary: vi.fn(),
  settlePendingDealPurchasePayouts: vi.fn(),
}));
vi.mock('@/lib/referral-payouts', () => ({
  emptyReferralPayoutSummary: vi.fn(() => ({
    pendingTransfer: 0,
    transferredToConnect: 0,
  })),
  getReferralPayoutSummary: vi.fn(),
  reconcileReferralCommissions: vi.fn(),
  settlePendingReferralCommissions: vi.fn(),
}));
vi.mock('@/lib/stripe-connect', () => ({
  fetchConnectPayoutsOverview: vi.fn(),
  isRecoverableConnectAccountError: vi.fn(() => false),
  syncBusinessConnectState: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import {
  getDealPayoutSummary,
  settlePendingDealPurchasePayouts,
} from '@/lib/deal-payouts';
import {
  getReferralPayoutSummary,
  reconcileReferralCommissions,
  settlePendingReferralCommissions,
} from '@/lib/referral-payouts';
import {
  fetchConnectPayoutsOverview,
  isRecoverableConnectAccountError,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockGetDealPayoutSummary = getDealPayoutSummary as ReturnType<typeof vi.fn>;
const mockGetReferralPayoutSummary = getReferralPayoutSummary as ReturnType<typeof vi.fn>;
const mockReconcileReferralCommissions = reconcileReferralCommissions as ReturnType<typeof vi.fn>;
const mockSettlePendingDealPurchasePayouts =
  settlePendingDealPurchasePayouts as ReturnType<typeof vi.fn>;
const mockSettlePendingReferralCommissions =
  settlePendingReferralCommissions as ReturnType<typeof vi.fn>;
const mockFetchConnectPayoutsOverview = fetchConnectPayoutsOverview as ReturnType<typeof vi.fn>;
const mockIsRecoverableConnectAccountError =
  isRecoverableConnectAccountError as ReturnType<typeof vi.fn>;
const mockSyncBusinessConnectState = syncBusinessConnectState as ReturnType<typeof vi.fn>;
const mockUpdateBusiness = prisma.business.update as ReturnType<typeof vi.fn>;
const mockDeleteBankAccount = prisma.businessBankAccount.deleteMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
  mockGetDealPayoutSummary.mockResolvedValue({
    pendingTransfer: 200,
    transferredToConnect: 8800,
  });
  mockGetReferralPayoutSummary.mockResolvedValue({
    pendingTransfer: 100,
    transferredToConnect: 4000,
  });
  mockReconcileReferralCommissions.mockResolvedValue(undefined);
  mockSettlePendingDealPurchasePayouts.mockResolvedValue(undefined);
  mockSettlePendingReferralCommissions.mockResolvedValue(undefined);
  mockIsRecoverableConnectAccountError.mockReturnValue(false);
  mockUpdateBusiness.mockResolvedValue({});
  mockDeleteBankAccount.mockResolvedValue({});
});

describe('GET /api/mobile/funds', () => {
  it('returns a setup-first payload when Stripe is not connected', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      name: 'Clientific Studio',
      email: 'owner@clientific.app',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      stripeConnectAccountId: null,
    });

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/funds', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.notConnected).toBe(true);
    expect(body.payoutReady).toBe(false);
    expect(body.referralPendingTransferLabel).toBe('$1.00');
    expect(body.dealTransferredLabel).toBe('$88.00');
  });

  it('returns live balances when Stripe payouts are ready', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      name: 'Clientific Studio',
      email: 'owner@clientific.app',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      stripeConnectAccountId: 'acct_1',
    });
    mockSyncBusinessConnectState.mockResolvedValue({
      accountId: 'acct_1',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
      externalAccount: {
        bankName: 'Mercury',
        last4: '1234',
      },
      payoutSchedule: {
        interval: 'manual',
        monthlyPayoutDays: [],
        weeklyPayoutDays: [],
      },
      requirements: {
        currentlyDue: [],
        pastDue: [],
        pendingVerification: [],
      },
    });
    mockFetchConnectPayoutsOverview.mockResolvedValue({
      balance: {
        available: [{ amount: 1820 }],
        pending: [{ amount: 400 }],
      },
      payouts: [
        {
          id: 'po_1',
          amount: 900,
          arrivalDate: 1774828800,
          bankLast4: '1234',
          bankName: 'Mercury',
          status: 'paid',
        },
      ],
    });

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/funds', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.payoutReady).toBe(true);
    expect(body.availableBalanceLabel).toBe('$18.20');
    expect(body.bankAccountSummary).toBe('Mercury ending in 1234');
    expect(body.recentPayouts).toHaveLength(1);
  });

  it('does not clear stored payout setup when a mobile status refresh cannot verify Stripe', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      name: 'Clientific Studio',
      email: 'owner@clientific.app',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      stripeConnectAccountId: 'acct_1',
    });
    mockSyncBusinessConnectState.mockRejectedValue({ code: 'resource_missing' });
    mockIsRecoverableConnectAccountError.mockReturnValue(true);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/funds', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.connectStatusUnavailable).toBe(true);
    expect(body.setupMessage).toContain('left unchanged');
    expect(mockUpdateBusiness).not.toHaveBeenCalled();
    expect(mockDeleteBankAccount).not.toHaveBeenCalled();
  });
});
