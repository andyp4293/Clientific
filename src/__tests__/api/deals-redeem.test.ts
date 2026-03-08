/**
 * Tests for deal redemption terminal:
 * - GET /api/deals/lookup
 * - POST /api/deals/redeem
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealRedemption: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET as lookupGET } from '@/app/api/deals/lookup/route';
import { POST as redeemPOST } from '@/app/api/deals/redeem/route';

const SESSION = { user: { id: 'biz-1' } };
const DEAL = {
  id: 'deal-1',
  businessId: 'biz-1',
  title: 'Test Deal',
  discountType: 'percent_off',
  discountValue: 20,
  platformFeePercent: 15,
};

function getReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

function postReq(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/deals/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/deals/lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await lookupGET(getReq('http://localhost/api/deals/lookup?code=ABCDEFGH'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when code is missing', async () => {
    const res = await lookupGET(getReq('http://localhost/api/deals/lookup'));
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown code', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue(null);
    const res = await lookupGET(getReq('http://localhost/api/deals/lookup?code=NOTFOUND'));
    expect(res.status).toBe(404);
  });

  it('returns 403 for code belonging to different business', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue({
      deal: { ...DEAL, businessId: 'other-biz' },
      customer: null,
      usedAt: null,
    } as any);
    const res = await lookupGET(getReq('http://localhost/api/deals/lookup?code=XXXXXXXX'));
    expect(res.status).toBe(403);
  });

  it('returns alreadyUsed: false for unused code', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue({
      deal: DEAL,
      customer: { name: 'Jane', phone: '5551234567' },
      usedAt: null,
    } as any);
    const res = await lookupGET(getReq('http://localhost/api/deals/lookup?code=ABCDEFGH'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyUsed).toBe(false);
    expect(body.deal.title).toBe('Test Deal');
    expect(body.customer.name).toBe('Jane');
  });

  it('returns alreadyUsed: true for used code', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue({
      deal: DEAL,
      customer: null,
      usedAt: new Date(),
    } as any);
    const res = await lookupGET(getReq('http://localhost/api/deals/lookup?code=ABCDEFGH'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyUsed).toBe(true);
  });
});

describe('POST /api/deals/redeem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(SESSION as any);
    vi.mocked(prisma.dealRedemption.update).mockResolvedValue({} as any);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await redeemPOST(postReq({ code: 'ABCDEFGH' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown code', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue(null);
    const res = await redeemPOST(postReq({ code: 'NOTFOUND' }));
    expect(res.status).toBe(404);
  });

  it('returns 403 for code from different business', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue({
      deal: { ...DEAL, businessId: 'other-biz' },
      customer: null,
      usedAt: null,
    } as any);
    const res = await redeemPOST(postReq({ code: 'XXXXXXXX' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for already-used code', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue({
      deal: DEAL,
      customer: null,
      usedAt: new Date(),
    } as any);
    const res = await redeemPOST(postReq({ code: 'ABCDEFGH' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already used/i);
  });

  it('redeems with no transactionAmount, platformFee is null', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue({
      deal: DEAL,
      customer: null,
      usedAt: null,
    } as any);
    const res = await redeemPOST(postReq({ code: 'ABCDEFGH' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.platformFee).toBeNull();
  });

  it('computes platformFee from transactionAmount and platformFeePercent', async () => {
    vi.mocked(prisma.dealRedemption.findUnique).mockResolvedValue({
      deal: DEAL, // platformFeePercent: 15
      customer: null,
      usedAt: null,
    } as any);
    const res = await redeemPOST(postReq({ code: 'ABCDEFGH', transactionAmount: 100 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.platformFee).toBe(15);
  });
});
