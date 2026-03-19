import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn() }));
vi.mock('@/lib/app-url', () => ({ getAppBaseUrlFromRequest: vi.fn(() => 'https://clientific.net') }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('@/lib/stripe-connect', () => ({
  ensureBusinessConnectAccount: vi.fn(),
  syncBusinessConnectState: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
import { prisma } from '@/lib/prisma';
import {
  ensureBusinessConnectAccount,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';
import { GET, POST } from './route';

const mockGetSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetBusinessId = getSessionBusinessId as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.business.update as ReturnType<typeof vi.fn>;
const mockEnsureConnect = ensureBusinessConnectAccount as ReturnType<typeof vi.fn>;
const mockSyncState = syncBusinessConnectState as ReturnType<typeof vi.fn>;

function makeRequest(method: 'GET' | 'POST' = 'GET') {
  return new NextRequest('http://localhost/api/stripe/connect/account', { method });
}

const business = {
  id: 'biz-1',
  email: 'owner@example.com',
  name: 'Test Salon',
  stripeConnectAccountId: 'acct_123',
  stripeConnectChargesEnabled: true,
  stripeConnectPayoutsEnabled: true,
  stripeConnectDetailsSubmitted: true,
};

const status = {
  accountId: 'acct_123',
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
    eventuallyDue: [],
    pastDue: [],
    pendingVerification: [],
    disabledReason: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({});
  mockGetBusinessId.mockReturnValue('biz-1');
  mockFindUnique.mockResolvedValue(business);
  mockEnsureConnect.mockResolvedValue({ id: 'acct_123' });
  mockSyncState.mockResolvedValue(status);
  mockUpdate.mockResolvedValue({});
});

describe('GET /api/stripe/connect/account', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetBusinessId.mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns notConnected when there is no connect account yet', async () => {
    mockFindUnique.mockResolvedValue({ ...business, stripeConnectAccountId: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).notConnected).toBe(true);
  });

  it('returns live connect status when account exists', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notConnected).toBe(false);
    expect(body.readyForPaidDeals).toBe(true);
    expect(body.externalAccount.last4).toBe('6789');
    expect(mockSyncState).toHaveBeenCalledWith('biz-1', 'acct_123');
  });

  it('clears stale state when Stripe account is missing', async () => {
    mockSyncState.mockRejectedValue({ code: 'resource_missing' });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).notConnected).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('POST /api/stripe/connect/account', () => {
  it('creates or ensures the connect account and returns status', async () => {
    const res = await POST(makeRequest('POST'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accountId).toBe('acct_123');
    expect(mockEnsureConnect).toHaveBeenCalled();
    expect(mockSyncState).toHaveBeenCalledWith('biz-1', 'acct_123');
  });
});
