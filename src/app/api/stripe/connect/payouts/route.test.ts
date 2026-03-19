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
vi.mock('@/lib/stripe-connect', () => ({
  syncBusinessConnectState: vi.fn(),
  fetchConnectPayoutsOverview: vi.fn(),
  isRecoverableConnectAccountError: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
import { prisma } from '@/lib/prisma';
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
const mockSyncStatus = syncBusinessConnectState as ReturnType<typeof vi.fn>;
const mockFetchOverview = fetchConnectPayoutsOverview as ReturnType<typeof vi.fn>;
const mockIsRecoverable = isRecoverableConnectAccountError as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest('http://localhost/api/stripe/connect/payouts');
}

const connectedBusiness = {
  id: 'biz-1',
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
    mockFindUnique.mockResolvedValue({ id: 'biz-1', stripeConnectAccountId: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notConnected).toBe(true);
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
    const body = await res.json();
    expect(body.notConnected).toBe(false);
    expect(body.readyForPaidDeals).toBe(true);
    expect(body.bankAccountConnected).toBe(true);
    expect(body.externalAccount.last4).toBe('6789');
    expect(body.payoutSchedule.interval).toBe('manual');
    expect(body.balances.available[0].amount).toBe(50000);
    expect(body.payouts[0].id).toBe('po_1');
    expect(mockSyncStatus).toHaveBeenCalledWith('biz-1', 'acct_test123');
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
    expect(body.balances).toBeNull();
    expect(body.payouts).toHaveLength(0);
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
});
