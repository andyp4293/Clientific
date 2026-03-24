import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    businessBankAccount: { deleteMany: vi.fn() },
  },
}));
vi.mock('@/lib/referral-payouts', () => ({
  emptyReferralPayoutSummary: vi.fn(() => ({
    lifetimeEarned: 0,
    pendingTransfer: 0,
    transferredToConnect: 0,
    pendingCount: 0,
    transferredCount: 0,
    lastTransferredAt: null,
  })),
  getReferralPayoutSummary: vi.fn(),
  reconcileReferralCommissions: vi.fn(),
  settlePendingReferralCommissions: vi.fn(),
}));
vi.mock('@/lib/deal-payouts', () => ({
  emptyDealPayoutSummary: vi.fn(() => ({
    lifetimeEarned: 0,
    pendingTransfer: 0,
    transferredToConnect: 0,
    pendingCount: 0,
    transferredCount: 0,
    automaticCount: 0,
    lastTransferredAt: null,
  })),
  getDealPayoutSummary: vi.fn(),
  settlePendingDealPurchasePayouts: vi.fn(),
}));
vi.mock('@/lib/stripe-connect', () => ({
  syncBusinessConnectState: vi.fn(),
  fetchConnectPayoutsOverview: vi.fn(),
  isRecoverableConnectAccountError: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
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
import { GET } from './route';

const mockGetSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetBusinessId = getSessionBusinessId as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.business.update as ReturnType<typeof vi.fn>;
const mockDeleteMany = prisma.businessBankAccount.deleteMany as ReturnType<typeof vi.fn>;
const mockGetDealSummary = getDealPayoutSummary as ReturnType<typeof vi.fn>;
const mockSettleDealPurchases =
  settlePendingDealPurchasePayouts as ReturnType<typeof vi.fn>;
const mockGetReferralSummary = getReferralPayoutSummary as ReturnType<typeof vi.fn>;
const mockReconcileReferralCommissions =
  reconcileReferralCommissions as ReturnType<typeof vi.fn>;
const mockSettleReferralCommissions =
  settlePendingReferralCommissions as ReturnType<typeof vi.fn>;
const mockSyncStatus = syncBusinessConnectState as ReturnType<typeof vi.fn>;
const mockFetchOverview = fetchConnectPayoutsOverview as ReturnType<typeof vi.fn>;
const mockIsRecoverable = isRecoverableConnectAccountError as ReturnType<typeof vi.fn>;

const referralSummary = {
  lifetimeEarned: 3240,
  pendingTransfer: 870,
  transferredToConnect: 2370,
  pendingCount: 1,
  transferredCount: 1,
  lastTransferredAt: '2026-03-10T12:00:00.000Z',
};

const dealSummary = {
  lifetimeEarned: 1280,
  pendingTransfer: 128,
  transferredToConnect: 1152,
  pendingCount: 1,
  transferredCount: 3,
  automaticCount: 2,
  lastTransferredAt: '2026-03-11T12:00:00.000Z',
};

function makeRequest() {
  return new NextRequest('http://localhost/api/stripe/connect/payouts');
}

const connectedBusiness = {
  id: 'biz-1',
  name: 'ABC Nails',
  email: 'andyp4293@gmail.com',
  businessType: 'Salon',
  stripeConnectAccountId: 'acct_test123',
};

const connectStatus = {
  accountId: 'acct_test123',
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  onboardingComplete: true,
  bankAccountConnected: true,
  externalAccount: {
    id: 'ba_123',
    bankName: 'Chase',
    last4: '6789',
    routingNumberLast4: '1100',
    accountHolderName: 'Acme Corp',
    status: 'verified',
  },
  payoutSchedule: {
    interval: 'manual',
    monthlyPayoutDays: [],
    weeklyPayoutDays: [],
    statementDescriptor: null,
  },
  requirements: {
    currentlyDue: [],
    eventuallyDue: ['representative.first_name'],
    pastDue: [],
    pendingVerification: [],
    disabledReason: null,
  },
};

const connectOverview = {
  balance: {
    available: [{ amount: 50000, currency: 'usd' }],
    pending: [{ amount: 12500, currency: 'usd' }],
  },
  payouts: [
    {
      id: 'po_1',
      amount: 45000,
      currency: 'usd',
      arrivalDate: 1710000000,
      status: 'paid',
      bankLast4: '6789',
      bankName: 'Chase',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({});
  mockGetBusinessId.mockReturnValue('biz-1');
  mockUpdate.mockResolvedValue({});
  mockDeleteMany.mockResolvedValue({});
  mockIsRecoverable.mockReturnValue(false);
  mockGetDealSummary.mockResolvedValue(dealSummary);
  mockReconcileReferralCommissions.mockResolvedValue({
    since: '2026-01-01T00:00:00.000Z',
    scannedInvoices: 0,
    matchedReferralInvoices: 0,
    createdCommissions: 0,
    duplicateInvoices: 0,
    skippedWithoutCustomer: 0,
    skippedWithoutReferral: 0,
    skippedZeroAmount: 0,
    skippedNonSubscription: 0,
  });
  mockSettleDealPurchases.mockResolvedValue({
    transferredAmount: 128,
    transferredCount: 1,
    automaticCount: 0,
    failedCount: 0,
  });
  mockGetReferralSummary.mockResolvedValue(referralSummary);
  mockSettleReferralCommissions.mockResolvedValue({
    transferredAmount: 870,
    transferredCount: 1,
  });
});

describe('GET /api/stripe/connect/payouts', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetBusinessId.mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 404 when business not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it('returns notConnected: true when no stripeConnectAccountId', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'ABC Nails',
      email: 'andyp4293@gmail.com',
      businessType: 'Salon',
      stripeConnectAccountId: null,
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notConnected).toBe(true);
    expect(body.businessName).toBe('ABC Nails');
    expect(body.businessEmail).toBe('andyp4293@gmail.com');
    expect(body.dealPayouts).toEqual(dealSummary);
    expect(body.referralPayouts).toEqual(referralSummary);
    expect(body.balances).toBeNull();
    expect(body.payouts).toHaveLength(0);
    expect(mockSyncStatus).not.toHaveBeenCalled();
  });

  it('returns live payout status and history for a fully onboarded account', async () => {
    mockFindUnique.mockResolvedValue(connectedBusiness);
    mockSyncStatus.mockResolvedValue(connectStatus);
    mockFetchOverview.mockResolvedValue(connectOverview);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const body = await res.json();
    expect(body.notConnected).toBe(false);
    expect(body.businessName).toBe('ABC Nails');
    expect(body.businessEmail).toBe('andyp4293@gmail.com');
    expect(body.readyForPaidDeals).toBe(true);
    expect(body.bankAccountConnected).toBe(true);
    expect(body.externalAccount.last4).toBe('6789');
    expect(body.payoutSchedule.interval).toBe('manual');
    expect(body.balances.available[0].amount).toBe(50000);
    expect(body.payouts[0].id).toBe('po_1');
    expect(body.dealPayouts).toEqual(dealSummary);
    expect(body.referralPayouts).toEqual(referralSummary);
    expect(mockSyncStatus).toHaveBeenCalledWith('biz-1', 'acct_test123');
    expect(mockReconcileReferralCommissions).toHaveBeenCalledWith({
      businessId: 'biz-1',
      lookbackDays: 90,
    });
    expect(mockSettleDealPurchases).toHaveBeenCalledWith({
      businessId: 'biz-1',
      connectAccountId: 'acct_test123',
    });
    expect(mockSettleReferralCommissions).toHaveBeenCalledWith({
      businessId: 'biz-1',
      connectAccountId: 'acct_test123',
    });
    expect(mockFetchOverview).toHaveBeenCalledWith('acct_test123');
  });

  it('skips payout history when onboarding is incomplete', async () => {
    mockFindUnique.mockResolvedValue(connectedBusiness);
    mockSyncStatus.mockResolvedValue({
      ...connectStatus,
      payoutsEnabled: false,
      onboardingComplete: false,
      bankAccountConnected: false,
      externalAccount: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboardingComplete).toBe(false);
    expect(body.dealPayouts).toEqual(dealSummary);
    expect(body.referralPayouts).toEqual(referralSummary);
    expect(body.balances).toBeNull();
    expect(body.payouts).toHaveLength(0);
    expect(mockSettleDealPurchases).not.toHaveBeenCalled();
    expect(mockSettleReferralCommissions).not.toHaveBeenCalled();
    expect(mockFetchOverview).not.toHaveBeenCalled();
  });

  it.each(['resource_missing', 'account_invalid'])(
    'clears stale connect state when Stripe returns %s',
    async (code) => {
      mockFindUnique.mockResolvedValue(connectedBusiness);
      mockSyncStatus.mockRejectedValue({ code });
      mockIsRecoverable.mockReturnValue(true);

      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notConnected).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockDeleteMany).toHaveBeenCalled();
    }
  );

  it('returns 500 when syncBusinessConnectState throws a non-recoverable error', async () => {
    mockFindUnique.mockResolvedValue(connectedBusiness);
    mockSyncStatus.mockRejectedValue(new Error('Stripe error'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it('still returns payout status when referral reconciliation fails', async () => {
    mockFindUnique.mockResolvedValue(connectedBusiness);
    mockReconcileReferralCommissions.mockRejectedValue(new Error('No such customer'));
    mockSyncStatus.mockResolvedValue(connectStatus);
    mockFetchOverview.mockResolvedValue(connectOverview);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.notConnected).toBe(false);
    expect(body.readyForPaidDeals).toBe(true);
  });
});
