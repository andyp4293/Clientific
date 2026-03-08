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

  it('passes location filter to prisma query when city parameter is provided', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req({ city: 'Miami' }));

    const callArgs = vi.mocked(prisma.deal.findMany).mock.calls[0][0] as any;
    const locationFilters = callArgs.where.business.OR;

    expect(locationFilters).toEqual(
      expect.arrayContaining([
        { city: { contains: 'Miami', mode: 'insensitive' } },
        { state: { contains: 'Miami', mode: 'insensitive' } },
        { zipCode: { contains: 'Miami', mode: 'insensitive' } },
      ])
    );
  });

  it('supports the location query parameter alias', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req({ location: '33101' }));

    const callArgs = vi.mocked(prisma.deal.findMany).mock.calls[0][0] as any;
    const locationFilters = callArgs.where.business.OR;

    expect(locationFilters).toEqual(
      expect.arrayContaining([
        { city: { contains: '33101', mode: 'insensitive' } },
        { state: { contains: '33101', mode: 'insensitive' } },
        { zipCode: { contains: '33101', mode: 'insensitive' } },
      ])
    );
  });

  it('normalizes city-like location values that include state suffixes', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req({ location: 'Miami, FL' }));

    const callArgs = vi.mocked(prisma.deal.findMany).mock.calls[0][0] as any;
    const locationFilters = callArgs.where.business.OR;

    expect(locationFilters).toEqual(
      expect.arrayContaining([
        { city: { contains: 'Miami', mode: 'insensitive' } },
        { state: { contains: 'Miami', mode: 'insensitive' } },
        { zipCode: { contains: 'Miami', mode: 'insensitive' } },
      ])
    );

    expect(locationFilters).not.toEqual(
      expect.arrayContaining([
        { city: { contains: 'Miami, FL', mode: 'insensitive' } },
      ])
    );
  });

  it('adds a dedicated ZIP filter when a ZIP is embedded in the location text', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req({ location: 'Miami FL 33101' }));

    const callArgs = vi.mocked(prisma.deal.findMany).mock.calls[0][0] as any;
    const locationFilters = callArgs.where.business.OR;

    expect(locationFilters).toEqual(
      expect.arrayContaining([
        { city: { contains: 'Miami FL 33101', mode: 'insensitive' } },
        { zipCode: { contains: '33101', mode: 'insensitive' } },
      ])
    );
  });

  it('does not attach a location OR block when no location is provided', async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([] as any);
    await GET(req());

    expect(prisma.deal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          business: expect.not.objectContaining({
            OR: expect.anything(),
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
