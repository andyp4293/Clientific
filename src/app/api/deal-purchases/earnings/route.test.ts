import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
vi.mock('@/lib/session-business', () => ({ getSessionBusinessId: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealPurchase: { findMany: vi.fn() },
    referralCommission: { findMany: vi.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import { getSessionBusinessId } from '@/lib/session-business';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetSession = getServerSession as ReturnType<typeof vi.fn>;
const mockGetBusinessId = getSessionBusinessId as ReturnType<typeof vi.fn>;
const mockDealFindMany = prisma.dealPurchase.findMany as ReturnType<typeof vi.fn>;
const mockReferralFindMany = prisma.referralCommission.findMany as ReturnType<typeof vi.fn>;

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

const referralFixtures = [
  {
    id: 'commission-1',
    createdAt: new Date('2026-03-15T10:30:00Z'),
    amountDollars: 12.5,
    transferStatus: 'transferred',
    transferFailureReason: null,
    transferredAt: new Date('2026-03-16T12:00:00Z'),
    referral: {
      referee: {
        name: 'Glow Spa',
        email: 'owner@glowspa.com',
        businessEmail: 'billing@glowspa.com',
      },
    },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({});
  mockGetBusinessId.mockReturnValue('biz-1');
  mockDealFindMany.mockResolvedValue([]);
  mockReferralFindMany.mockResolvedValue([]);
});

describe('GET /api/deal-purchases/earnings', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetBusinessId.mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns empty entries and zero totals when there are no earnings yet', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(0);
    expect(body.totals.dealGross).toBe(0);
    expect(body.totals.dealFees).toBe(0);
    expect(body.totals.dealNet).toBe(0);
    expect(body.totals.referralNet).toBe(0);
    expect(body.totals.entryCount).toBe(0);
  });

  it('returns merged deal and referral earnings entries with the correct shape', async () => {
    mockDealFindMany.mockResolvedValue(purchaseFixtures);
    mockReferralFindMany.mockResolvedValue(referralFixtures);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(3);

    const referralEntry = body.entries[0];
    expect(referralEntry.id).toBe('commission-1');
    expect(referralEntry.kind).toBe('referral');
    expect(referralEntry.sourceName).toBe('Glow Spa');
    expect(referralEntry.detailLabel).toBe('billing@glowspa.com');
    expect(referralEntry.grossAmount).toBe(1250);
    expect(referralEntry.feeAmount).toBe(0);
    expect(referralEntry.netAmount).toBe(1250);
    expect(referralEntry.status).toBe('transferred');

    const dealEntry = body.entries[1];
    expect(dealEntry.id).toBe('purchase-2');
    expect(dealEntry.kind).toBe('deal');
    expect(dealEntry.sourceName).toBe('Spring Special');
    expect(dealEntry.detailLabel).toBe('Bob Smith');
    expect(dealEntry.detailPhone).toBe('+15559876543');
    expect(dealEntry.grossAmount).toBe(10200);
    expect(dealEntry.feeAmount).toBe(1530);
    expect(dealEntry.netAmount).toBe(8670);
  });

  it('computes correct totals across deals and referrals', async () => {
    mockDealFindMany.mockResolvedValue(purchaseFixtures);
    mockReferralFindMany.mockResolvedValue(referralFixtures);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.totals.dealGross).toBe(4000 + 10200);
    expect(body.totals.dealFees).toBe(600 + 1530);
    expect(body.totals.dealNet).toBe(3400 + 8670);
    expect(body.totals.referralNet).toBe(1250);
    expect(body.totals.totalNet).toBe(3400 + 8670 + 1250);
    expect(body.totals.dealCount).toBe(2);
    expect(body.totals.referralCount).toBe(1);
    expect(body.totals.entryCount).toBe(3);
  });

  it('shows retryable Stripe balance transfer errors as waiting instead of failed', async () => {
    mockReferralFindMany.mockResolvedValue([
      {
        id: 'commission-retryable',
        createdAt: new Date('2026-05-20T10:30:00Z'),
        amountDollars: 20.7,
        transferStatus: 'pending',
        transferFailureReason:
          'You have insufficient funds in your Stripe account. One likely reason you have insufficient funds is that your funds are automatically being paid out.',
        transferredAt: null,
        referral: {
          referee: {
            name: 'Jackson Nails',
            email: 'ankhangjr@yahoo.com',
            businessEmail: 'ankhangjr@yahoo.com',
          },
        },
      },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.entries[0]).toMatchObject({
      id: 'commission-retryable',
      kind: 'referral',
      sourceName: 'Jackson Nails',
      status: 'waiting_for_stripe_balance',
      grossAmount: 2070,
      netAmount: 2070,
    });
  });

  it('queries deal purchases and referral commissions for the session business', async () => {
    await GET(makeRequest());
    expect(mockDealFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'biz-1', status: { in: ['paid', 'redeemed'] } },
      })
    );
    expect(mockReferralFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          referral: {
            referrerId: 'biz-1',
          },
        },
      })
    );
  });

  it('returns 500 on unexpected DB error', async () => {
    mockDealFindMany.mockRejectedValue(new Error('DB down'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
