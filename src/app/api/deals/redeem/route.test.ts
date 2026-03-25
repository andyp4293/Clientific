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
    dealRedemption: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockDealRedemptionFindUnique = prisma.dealRedemption.findUnique as ReturnType<typeof vi.fn>;
const mockDealRedemptionUpdate = prisma.dealRedemption.update as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown> = { code: 'ABCD1234' }) {
  return new NextRequest('http://localhost/api/deals/redeem', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/deals/redeem', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when deal belongs to different business than session.businessId', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', businessId: 'biz-1' },
    });
    mockDealRedemptionFindUnique.mockResolvedValue({
      deal: {
        businessId: 'user-1',
        title: 'VIP Offer',
        discountType: 'amount_off',
        discountValue: 10,
        platformFeePercent: 10,
      },
      customer: null,
      usedAt: null,
    });

    const res = await POST(makeRequest({ code: 'ABCD1234', transactionAmount: 100 }));
    expect(res.status).toBe(403);
    expect(mockDealRedemptionUpdate).not.toHaveBeenCalled();
  });

  it('falls back to session.user.id when businessId is missing', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'biz-legacy' },
    });
    mockDealRedemptionFindUnique.mockResolvedValue({
      deal: {
        businessId: 'biz-legacy',
        title: 'Legacy Offer',
        discountType: 'percent_off',
        discountValue: 15,
        platformFeePercent: 10,
      },
      customer: { name: 'Jane', phone: '+15551234567' },
      usedAt: null,
    });
    mockDealRedemptionUpdate.mockResolvedValue({});

    const res = await POST(makeRequest({ code: 'LEGACY1', transactionAmount: 100 }));
    expect(res.status).toBe(200);
    expect(mockDealRedemptionUpdate).toHaveBeenCalledTimes(1);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.platformFee).toBe(10);
  });
});
