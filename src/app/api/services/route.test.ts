import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    service: { findMany: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
    serviceGroup: { findFirst: vi.fn() },
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
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { GET, POST } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockServiceFindMany = prisma.service.findMany as ReturnType<typeof vi.fn>;
const mockServiceCreate = prisma.service.create as ReturnType<typeof vi.fn>;
const mockServiceAggregate = prisma.service.aggregate as ReturnType<typeof vi.fn>;
const mockServiceGroupFindFirst = prisma.serviceGroup.findFirst as ReturnType<typeof vi.fn>;

// Services use session.user.email for business lookup, session.user.businessId for sub check
const activeSession = { user: { businessId: 'biz-1', email: 'owner@test.com' } };
const fakeBusiness = { id: 'biz-1', email: 'owner@test.com' };

function makeRequest(body: Record<string, unknown> = { name: 'Haircut', duration: 30 }) {
  return new NextRequest('http://localhost/api/services', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockServiceAggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
});

describe('GET /api/services', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns services list for authenticated business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue(fakeBusiness);
    mockServiceFindMany.mockResolvedValue([
      { id: 'svc-1', name: 'Haircut', duration: 30, active: true },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.services).toHaveLength(1);
    // Maps 'active' -> 'isActive'
    expect(body.services[0].isActive).toBe(true);
  });
});

describe('POST /api/services', () => {
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

  it('returns 403 PLAN_LIMIT_REACHED when at services limit', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 10 },
      });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('PLAN_LIMIT_REACHED');
  });

  it('returns 400 when name is missing', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      });
    const res = await POST(makeRequest({ duration: 30 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when duration is less than 5', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      });
    const res = await POST(makeRequest({ name: 'Haircut', duration: 3 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when service text contains disallowed content', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      });
    const res = await POST(makeRequest({ name: 'Nude package', duration: 30 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed content/i);
  });

  it('creates service successfully when active and under limit', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      })
      .mockResolvedValueOnce(fakeBusiness); // business lookup for create
    const fakeService = { id: 'svc-1', name: 'Haircut', duration: 30, active: true };
    mockServiceCreate.mockResolvedValue(fakeService);
    const res = await POST(makeRequest({ name: 'Haircut', duration: 30, price: 25 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.service.id).toBe('svc-1');
    expect(body.service.isActive).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('services-biz-1', 'max');
    expect(revalidateTag).toHaveBeenCalledWith('service-groups-biz-1', 'max');
  });

  it('returns 400 when groupId is not owned by business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      })
      .mockResolvedValueOnce(fakeBusiness);
    mockServiceGroupFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ name: 'Haircut', duration: 30, groupId: 'bad-group-id' }));
    expect(res.status).toBe(400);
  });

  it('persists groupId when creating a grouped service', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      })
      .mockResolvedValueOnce(fakeBusiness);
    mockServiceGroupFindFirst.mockResolvedValue({ id: 'group-1' });
    mockServiceCreate.mockResolvedValue({
      id: 'svc-1',
      name: 'Haircut',
      duration: 30,
      groupId: 'group-1',
      active: true,
    });

    const res = await POST(makeRequest({ name: 'Haircut', duration: 30, groupId: 'group-1' }));
    expect(res.status).toBe(201);
    expect(mockServiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: 'group-1',
        }),
      })
    );
    expect(revalidateTag).toHaveBeenCalledWith('services-biz-1', 'max');
    expect(revalidateTag).toHaveBeenCalledWith('service-groups-biz-1', 'max');
  });
});
