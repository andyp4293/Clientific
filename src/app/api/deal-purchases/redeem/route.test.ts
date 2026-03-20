import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/session-business', () => ({
  getSessionBusinessId: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealPurchase: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

const mockGetSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetBusinessId = getSessionBusinessId as ReturnType<typeof vi.fn>;
const mockFindFirst = prisma.dealPurchase.findFirst as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.dealPurchase.update as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/deal-purchases/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const purchaseFixture = {
  id: 'purchase-1',
  redemptionCode: 'ABCD1234',
  redeemedAt: null,
  purchasedAt: new Date('2026-03-10T10:00:00Z'),
  totalAmount: 4200,
  customerName: 'Jane Doe',
  customerPhone: '+15551234567',
  deal: {
    title: 'Spring Offer',
    discountType: 'percent_off',
    discountValue: 20,
  },
  items: [
    {
      serviceName: 'Gel Manicure',
      quantity: 1,
      originalUnitAmount: 5200,
      discountedUnitAmount: 4200,
    },
  ],
};

describe('POST /api/deal-purchases/redeem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({});
    mockGetBusinessId.mockReturnValue('biz-1');
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetBusinessId.mockReturnValue(null);

    const res = await POST(makeRequest({ purchaseId: 'purchase-1' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when neither purchaseId nor code is provided', async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'purchaseId or code is required',
    });
  });

  it('returns 404 when the purchase is not found for the business', async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ code: 'ABCD1234' }));

    expect(res.status).toBe(404);
  });

  it('redeems a purchase the first time it is used', async () => {
    mockFindFirst.mockResolvedValue(purchaseFixture);
    mockUpdate.mockResolvedValue({});

    const res = await POST(makeRequest({ purchaseId: 'purchase-1' }));

    expect(res.status).toBe(200);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
        }),
      })
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'purchase-1' },
        data: expect.objectContaining({
          status: 'redeemed',
          redeemedAt: expect.any(Date),
        }),
      })
    );

    await expect(res.json()).resolves.toMatchObject({
      success: true,
      alreadyRedeemed: false,
      purchase: {
        id: 'purchase-1',
        redemptionCode: 'ABCD1234',
      },
    });
  });

  it('returns alreadyRedeemed without updating when the purchase was redeemed earlier', async () => {
    mockFindFirst.mockResolvedValue({
      ...purchaseFixture,
      redeemedAt: new Date('2026-03-11T10:00:00Z'),
    });

    const res = await POST(makeRequest({ code: 'ABCD1234' }));

    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      alreadyRedeemed: true,
    });
  });
});
