import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/stripe-connect', () => ({
  fetchConnectPayoutsOverview: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
import { prisma } from '@/lib/prisma';
import { fetchConnectPayoutsOverview } from '@/lib/stripe-connect';
import { GET } from './route';

const mockGetSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetBusinessId = getSessionBusinessId as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFetchOverview = fetchConnectPayoutsOverview as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest('http://localhost/api/stripe/connect/payouts');
}

const fullyOnboardedBusiness = {
  stripeConnectAccountId: 'acct_test123',
  stripeConnectChargesEnabled: true,
  stripeConnectPayoutsEnabled: true,
  stripeConnectOnboardedAt: new Date('2026-01-01'),
};

const connectOverview = {
  balance: {
    available: [{ amount: 50000, currency: 'usd' }],
    pending: [{ amount: 12500, currency: 'usd' }],
  },
  payouts: [
    { id: 'po_1', amount: 45000, currency: 'usd', arrivalDate: 1710000000, status: 'paid', bankLast4: '6789', bankName: 'Chase' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({});
  mockGetBusinessId.mockReturnValue('biz-1');
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
    mockFindUnique.mockResolvedValue({ stripeConnectAccountId: null, stripeConnectChargesEnabled: false, stripeConnectPayoutsEnabled: false, stripeConnectOnboardedAt: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notConnected).toBe(true);
    expect(body.balances).toBeNull();
    expect(body.payouts).toHaveLength(0);
    expect(mockFetchOverview).not.toHaveBeenCalled();
  });

  it('returns onboardingComplete: false when account not fully onboarded', async () => {
    mockFindUnique.mockResolvedValue({ stripeConnectAccountId: 'acct_partial', stripeConnectChargesEnabled: false, stripeConnectPayoutsEnabled: false, stripeConnectOnboardedAt: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notConnected).toBe(false);
    expect(body.onboardingComplete).toBe(false);
    expect(body.balances).toBeNull();
    expect(mockFetchOverview).not.toHaveBeenCalled();
  });

  it('fetches and returns payout overview for fully onboarded account', async () => {
    mockFindUnique.mockResolvedValue(fullyOnboardedBusiness);
    mockFetchOverview.mockResolvedValue(connectOverview);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.onboardingComplete).toBe(true);
    expect(body.chargesEnabled).toBe(true);
    expect(body.payoutsEnabled).toBe(true);
    expect(body.balances.available[0].amount).toBe(50000);
    expect(body.balances.pending[0].amount).toBe(12500);
    expect(body.payouts).toHaveLength(1);
    expect(body.payouts[0].id).toBe('po_1');
    expect(body.payouts[0].bankLast4).toBe('6789');
    expect(mockFetchOverview).toHaveBeenCalledWith('acct_test123');
  });

  it('returns 500 when fetchConnectPayoutsOverview throws', async () => {
    mockFindUnique.mockResolvedValue(fullyOnboardedBusiness);
    mockFetchOverview.mockRejectedValue(new Error('Stripe error'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
