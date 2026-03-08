import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    deal: { findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {},
  PRICING_PLANS: {
    STARTER: { name: 'Starter', limits: { customers: 100, staff: 2, services: 10 } },
    PRO: { name: 'Pro', limits: { customers: 1000, staff: 10, services: 50 } },
    PREMIUM: { name: 'Premium', limits: { customers: Infinity, staff: Infinity, services: Infinity } },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET, POST } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockDealFindMany = prisma.deal.findMany as ReturnType<typeof vi.fn>;
const mockDealCreate = prisma.deal.create as ReturnType<typeof vi.fn>;

// Deals use session.user.id as businessId directly
const activeSession = { user: { id: 'biz-1' } };

const validDealBody = {
  title: '20% Off Haircut',
  discountType: 'percent_off',
  discountValue: 20,
  startsAt: new Date(Date.now() - 1000).toISOString(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

function makeRequest(body: Record<string, unknown> = validDealBody) {
  return new NextRequest('http://localhost/api/deals', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/deals', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns deals for authenticated business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockDealFindMany.mockResolvedValue([{ id: 'deal-1', title: '20% Off', redemptions: [] }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deals).toHaveLength(1);
  });
});

describe('POST /api/deals', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 SUBSCRIPTION_REQUIRED when trial expired', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() - 86400000),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 400 when required fields are missing', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(makeRequest({ title: 'No dates deal', discountType: 'percent_off', discountValue: 10 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when deal text contains disallowed content', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(
      makeRequest({
        ...validDealBody,
        title: 'Free blowjob special',
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed content/i);
  });

  it('returns 400 when discountValue is missing for non-free deal', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const body = { ...validDealBody };
    delete (body as any).discountValue;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it('creates deal successfully with active subscription', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const fakeDeal = { id: 'deal-1', ...validDealBody, businessId: 'biz-1', service: null };
    mockDealCreate.mockResolvedValue(fakeDeal);
    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.deal.id).toBe('deal-1');
  });

  it('creates free_service deal without discountValue', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const freeDeal = {
      title: 'Free Consultation',
      discountType: 'free_service',
      startsAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const fakeDeal = { id: 'deal-2', ...freeDeal, discountValue: 0, businessId: 'biz-1', service: null };
    mockDealCreate.mockResolvedValue(fakeDeal);
    const res = await POST(makeRequest(freeDeal));
    expect(res.status).toBe(201);
  });
});
