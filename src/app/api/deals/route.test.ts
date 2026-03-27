import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
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
    STARTER: { name: 'Starter', limits: { customers: 100, staff: 10, services: 10 } },
    PRO: { name: 'Pro', limits: { customers: 1000, staff: 50, services: 50 } },
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
  startsAt: '2026-03-10',
  expiresAt: '2026-03-12',
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
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-10T15:00:00.000Z'));
  mockBusiness.mockResolvedValue({
    subscriptionStatus: 'active',
    trialEndsAt: null,
    stripeConnectAccountId: 'acct_123',
    stripeConnectChargesEnabled: true,
    stripeConnectPayoutsEnabled: true,
    stripeConnectDetailsSubmitted: true,
  });
});

afterAll(() => {
  vi.useRealTimers();
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

  it('returns 400 when date input is invalid', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(
      makeRequest({
        ...validDealBody,
        startsAt: 'not-a-date',
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid deal dates/i);
  });

  it('returns 400 when start date is earlier than today', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(
      makeRequest({
        ...validDealBody,
        startsAt: '2026-03-09',
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start date cannot be earlier than today/i);
  });

  it('returns 400 when end date is the same day as start date', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(
      makeRequest({
        ...validDealBody,
        startsAt: '2026-03-10',
        expiresAt: '2026-03-10',
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/end date must be at least one day after start date/i);
  });

  it('creates deal successfully with active subscription', async () => {
    mockSession.mockResolvedValue(activeSession);
    const fakeDeal = { id: 'deal-1', ...validDealBody, newCustomersOnly: true, businessId: 'biz-1', service: null };
    mockDealCreate.mockResolvedValue(fakeDeal);
    const res = await POST(makeRequest({ ...validDealBody, newCustomersOnly: true }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.deal.id).toBe('deal-1');
    const createArgs = mockDealCreate.mock.calls.at(-1)?.[0] as any;
    expect(createArgs.data.newCustomersOnly).toBe(true);
  });

  it('creates free_service deal without discountValue', async () => {
    mockSession.mockResolvedValue(activeSession);
    const freeDeal = {
      title: 'Free Consultation',
      discountType: 'free_service',
      startsAt: '2026-03-10',
      expiresAt: '2026-03-11',
    };
    const fakeDeal = { id: 'deal-2', ...freeDeal, discountValue: 0, businessId: 'biz-1', service: null };
    mockDealCreate.mockResolvedValue(fakeDeal);
    const res = await POST(makeRequest(freeDeal));
    expect(res.status).toBe(201);
  });

  it('returns 409 when a paid purchase-link deal is created before payouts are ready', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue({
      subscriptionStatus: 'active',
      trialEndsAt: null,
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(409);
    expect(mockDealCreate).not.toHaveBeenCalled();
    expect((await res.json()).error).toMatch(/payout setup/i);
  });

  it('allows a guaranteed-free purchase-link deal even before payouts are ready', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue({
      subscriptionStatus: 'active',
      trialEndsAt: null,
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
    });
    mockDealCreate.mockResolvedValue({
      id: 'deal-free',
      title: 'Free Consultation',
      discountType: 'free_service',
      discountValue: 0,
      businessId: 'biz-1',
      service: null,
    });

    const res = await POST(
      makeRequest({
        title: 'Free Consultation',
        discountType: 'free_service',
        startsAt: '2026-03-10',
        expiresAt: '2026-03-11',
      })
    );

    expect(res.status).toBe(201);
  });

  it('returns 400 for percent_off > 100', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(makeRequest({ ...validDealBody, discountType: 'percent_off', discountValue: 150 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/between 1% and 100%/i);
  });

  it('returns 400 for percent_off = 0', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(makeRequest({ ...validDealBody, discountType: 'percent_off', discountValue: 0 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative percent_off', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(makeRequest({ ...validDealBody, discountType: 'percent_off', discountValue: -10 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for amount_off = 0', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(makeRequest({ ...validDealBody, discountType: 'amount_off', discountValue: 0 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/greater than \$0/i);
  });

  it('returns 400 for negative amount_off', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(makeRequest({ ...validDealBody, discountType: 'amount_off', discountValue: -5 }));
    expect(res.status).toBe(400);
  });

  it('allows amount_off larger than any single service price (discount is capped at checkout)', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const fakeDeal = { id: 'deal-x', discountType: 'amount_off', discountValue: 50, businessId: 'biz-1', service: null };
    mockDealCreate.mockResolvedValue(fakeDeal);
    // $50 off is valid at creation time — we don't know service prices yet for all_services deals
    const res = await POST(makeRequest({ ...validDealBody, discountType: 'amount_off', discountValue: 50 }));
    expect(res.status).toBe(201);
  });

  it('normalizes date-only inputs to full-day bounds', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockDealCreate.mockResolvedValue({
      id: 'deal-3',
      ...validDealBody,
      businessId: 'biz-1',
      service: null,
    });

    const res = await POST(
      makeRequest({
        ...validDealBody,
        startsAt: '2026-03-10',
        expiresAt: '2026-03-11',
      })
    );
    expect(res.status).toBe(201);

    const createArgs = mockDealCreate.mock.calls[0][0] as any;
    const startsAt = createArgs.data.startsAt as Date;
    const expiresAt = createArgs.data.expiresAt as Date;

    expect(startsAt.getHours()).toBe(0);
    expect(startsAt.getMinutes()).toBe(0);
    expect(expiresAt.getHours()).toBe(23);
    expect(expiresAt.getMinutes()).toBe(59);
  });
});
