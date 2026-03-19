import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    deal: {
      findUnique: vi.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockDealFindUnique = prisma.deal.findUnique as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest('http://localhost/api/public/deals/deal-1');
}

function makeParams(id = 'deal-1') {
  return { params: Promise.resolve({ id }) };
}

function makeDeal(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();

  return {
    id: 'deal-1',
    title: 'Spring Special',
    description: 'Save on your next visit',
    discountType: 'percent_off',
    discountValue: 20,
    startsAt: new Date(now - 60_000),
    expiresAt: new Date(now + 60_000),
    active: true,
    maxRedemptions: null,
    redemptionCount: 0,
    businessId: 'biz-1',
    service: { name: 'Haircut' },
    business: {
      name: 'Test Salon',
      slug: 'test-salon',
      publicId: 'pub-1',
      city: 'Austin',
      state: 'TX',
      stripeConnectAccountId: 'acct_123',
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
    },
    ...overrides,
  };
}

describe('GET /api/public/deals/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks viewerCanManage false for public visitors', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockDealFindUnique.mockResolvedValue(makeDeal());

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      deal: {
        id: 'deal-1',
        viewerCanManage: false,
        business: {
          name: 'Test Salon',
        },
      },
    });
  });

  it('marks viewerCanManage true for the owning business session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        businessId: 'biz-1',
      },
    });
    mockDealFindUnique.mockResolvedValue(makeDeal());

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      deal: {
        id: 'deal-1',
        viewerCanManage: true,
      },
    });
  });

  it('hides a paid purchase-link deal when Stripe payouts are not ready', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockDealFindUnique.mockResolvedValue(
      makeDeal({
        deliveryType: 'purchase_link',
        business: {
          name: 'Test Salon',
          slug: 'test-salon',
          publicId: 'pub-1',
          city: 'Austin',
          state: 'TX',
          stripeConnectAccountId: null,
          stripeConnectChargesEnabled: false,
          stripeConnectPayoutsEnabled: false,
          stripeConnectDetailsSubmitted: false,
        },
      })
    );

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(404);
  });
});
