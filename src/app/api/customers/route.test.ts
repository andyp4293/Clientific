import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock stripe
vi.mock('@/lib/stripe', () => ({
  stripe: {},
  PRICING_PLANS: {
    STARTER: {
      name: 'Starter',
      limits: { customers: 100, staff: 2, services: 10 },
    },
    PRO: {
      name: 'Pro',
      limits: { customers: 1000, staff: 10, services: 50 },
    },
    PREMIUM: {
      name: 'Premium',
      limits: { customers: Infinity, staff: Infinity, services: Infinity },
    },
  },
}));

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/utils', () => ({
  formatPhoneNumber: (phone: string) => phone,
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockCustomerCreate = prisma.customer.create as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown> = { name: 'Test Customer' }) {
  return new NextRequest('http://localhost/api/customers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/customers', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 with SUBSCRIPTION_REQUIRED when trial is expired', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { businessId: 'biz-1', email: 'test@test.com' },
    });
    // Expired trial
    mockBusinessFindUnique.mockResolvedValue({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 403 with SUBSCRIPTION_REQUIRED when subscription is canceled', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { businessId: 'biz-1', email: 'test@test.com' },
    });
    mockBusinessFindUnique.mockResolvedValue({
      subscriptionStatus: 'canceled',
      trialEndsAt: null,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 403 with PLAN_LIMIT_REACHED when at starter customer limit', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { businessId: 'biz-1', email: 'test@test.com' },
    });
    // First call: subscription check (active)
    // Second call: plan limit check (at limit)
    mockBusinessFindUnique
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 100, staff: 0, services: 0 },
      });

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('PLAN_LIMIT_REACHED');
  });

  it('creates customer successfully when active and under limit', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { businessId: 'biz-1', email: 'test@test.com' },
    });
    // Subscription check (active)
    mockBusinessFindUnique
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 5, staff: 0, services: 0 },
      });

    mockCustomerFindFirst.mockResolvedValue(null); // no duplicate
    const fakeCustomer = { id: 'cust-1', name: 'Test Customer', businessId: 'biz-1' };
    mockCustomerCreate.mockResolvedValue(fakeCustomer);

    const res = await POST(makeRequest({ name: 'Test Customer' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.customer.id).toBe('cust-1');
  });

  it('creates customer successfully during valid trial', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { businessId: 'biz-1', email: 'test@test.com' },
    });
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockBusinessFindUnique
      .mockResolvedValueOnce({ subscriptionStatus: 'trialing', trialEndsAt: future })
      .mockResolvedValueOnce({
        subscriptionPlan: 'trial',
        _count: { customers: 5, staff: 0, services: 0 },
      });

    mockCustomerFindFirst.mockResolvedValue(null);
    mockCustomerCreate.mockResolvedValue({ id: 'cust-2', name: 'Trial Customer', businessId: 'biz-1' });

    const res = await POST(makeRequest({ name: 'Trial Customer' }));
    expect(res.status).toBe(201);
  });
});
