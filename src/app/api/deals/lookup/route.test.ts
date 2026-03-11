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
    },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockDealRedemptionFindUnique = prisma.dealRedemption.findUnique as ReturnType<typeof vi.fn>;

function makeRequest(code = 'ABCD1234') {
  return new NextRequest(`http://localhost/api/deals/lookup?code=${code}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/deals/lookup', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when deal belongs to different business than session.businessId', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', businessId: 'biz-1' },
    });
    mockDealRedemptionFindUnique.mockResolvedValue({
      deal: {
        businessId: 'user-1',
        title: '50% off',
        discountType: 'percent_off',
        discountValue: 50,
      },
      customer: null,
      usedAt: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('falls back to session.user.id when businessId is missing', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'biz-legacy' },
    });
    mockDealRedemptionFindUnique.mockResolvedValue({
      deal: {
        businessId: 'biz-legacy',
        title: '20% off',
        discountType: 'percent_off',
        discountValue: 20,
      },
      customer: { name: 'Jane', phone: '+15551234567' },
      usedAt: null,
    });

    const res = await GET(makeRequest('LEGACY1'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.alreadyUsed).toBe(false);
    expect(body.deal.title).toBe('20% off');
  });
});

