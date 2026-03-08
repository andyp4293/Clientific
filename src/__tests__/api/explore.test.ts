/**
 * Tests for GET /api/public/explore/deals
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    deal: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/public/explore/deals/route';

const now = new Date();
const future = new Date(now.getTime() + 7 * 86400000);
const past = new Date(now.getTime() - 86400000);

function makeDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deal-1',
    title: 'Test Deal',
    discountType: 'percent_off',
    discountValue: 20,
    expiresAt: future,
    maxRedemptions: null,
    redemptionCount: 0,
    business: { name: 'Test Salon', businessType: 'nails', city: 'Miami', slug: 'test-salon', publicId: 'pub123' },
    ...overrides,
  };
}

function req(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/public/explore/deals');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

describe('GET /api/public/explore/deals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns active in-window deals', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([makeDeal()] as any);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deals).toHaveLength(1);
    expect(body.deals[0].title).toBe('Test Deal');
  });

  it('excludes maxed-out deals', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      makeDeal({ maxRedemptions: 5, redemptionCount: 5 }),
    ] as any);
    const res = await GET(req());
    const body = await res.json();
    expect(body.deals).toHaveLength(0);
  });

  it('includes deals not yet maxed', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([
      makeDeal({ maxRedemptions: 10, redemptionCount: 3 }),
    ] as any);
    const res = await GET(req());
    const body = await res.json();
    expect(body.deals).toHaveLength(1);
  });

  it('passes city filter to prisma query', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req({ city: 'Miami' }));
    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          business: expect.objectContaining({
            city: { contains: 'Miami', mode: 'insensitive' },
          }),
        }),
      })
    );
  });

  it('passes category filter to prisma query', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req({ category: 'nails' }));
    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          business: expect.objectContaining({ businessType: 'nails' }),
        }),
      })
    );
  });

  it('does not filter by businessType when category is "all"', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req({ category: 'all' }));
    const callArgs = vi.mocked(prisma.deal.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.business.businessType).toBeUndefined();
  });

  it('clamps limit to 48', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req({ limit: '200' }));
    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 48 })
    );
  });

  it('defaults limit to 24', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req());
    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 24 })
    );
  });
});
