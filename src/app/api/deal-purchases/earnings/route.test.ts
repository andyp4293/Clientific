import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealPurchase: { findMany: vi.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetBusinessId = getSessionBusinessId as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.dealPurchase.findMany as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest('http://localhost/api/deal-purchases/earnings');
}

const purchaseFixtures = [
  {
    id: 'purchase-1',
    customerName: 'Jane Doe',
    customerPhone: '+15551234567',
    totalAmount: 4000,
    applicationFeeAmount: 600,
    businessNetAmount: 3400,
    status: 'paid',
    purchasedAt: new Date('2026-03-10T10:00:00Z'),
    redeemedAt: null,
    redemptionCode: 'ABCD1234',
    deal: { title: 'Spring Special' },
  },
  {
    id: 'purchase-2',
    customerName: 'Bob Smith',
    customerPhone: '+15559876543',
    totalAmount: 10200,
    applicationFeeAmount: 1530,
    businessNetAmount: 8670,
    status: 'redeemed',
    purchasedAt: new Date('2026-03-12T14:00:00Z'),
    redeemedAt: new Date('2026-03-14T09:00:00Z'),
    redemptionCode: 'EFGH5678',
    deal: { title: 'Spring Special' },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({});
  mockGetBusinessId.mockReturnValue('biz-1');
});

describe('GET /api/deal-purchases/earnings', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetBusinessId.mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns empty transactions and zero totals when no purchases', async () => {
    mockFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toHaveLength(0);
    expect(body.totals.totalGross).toBe(0);
    expect(body.totals.totalFees).toBe(0);
    expect(body.totals.totalNet).toBe(0);
    expect(body.totals.transactionCount).toBe(0);
  });

  it('returns transactions with correct shape', async () => {
    mockFindMany.mockResolvedValue(purchaseFixtures);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toHaveLength(2);
    const t = body.transactions[0];
    expect(t.id).toBe('purchase-1');
    expect(t.dealTitle).toBe('Spring Special');
    expect(t.customerName).toBe('Jane Doe');
    expect(t.totalAmount).toBe(4000);
    expect(t.applicationFeeAmount).toBe(600);
    expect(t.businessNetAmount).toBe(3400);
    expect(t.redemptionCode).toBe('ABCD1234');
  });

  it('computes correct totals across transactions', async () => {
    mockFindMany.mockResolvedValue(purchaseFixtures);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.totals.totalGross).toBe(4000 + 10200);
    expect(body.totals.totalFees).toBe(600 + 1530);
    expect(body.totals.totalNet).toBe(3400 + 8670);
    expect(body.totals.transactionCount).toBe(2);
  });

  it('queries only paid and redeemed purchases for the session business', async () => {
    mockFindMany.mockResolvedValue([]);
    await GET(makeRequest());
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'biz-1', status: { in: ['paid', 'redeemed'] } },
      })
    );
  });

  it('returns 500 on unexpected DB error', async () => {
    mockFindMany.mockRejectedValue(new Error('DB down'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
