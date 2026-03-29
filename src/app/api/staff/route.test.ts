import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    businessHours: { findUnique: vi.fn() },
    staff: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
      staff: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
      staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
    })),
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
const mockStaffFindMany = prisma.staff.findMany as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown> = { fullName: 'John Doe' }) {
  return new NextRequest('http://localhost/api/staff', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function makeGetRequest() {
  return new NextRequest('http://localhost/api/staff', { method: 'GET' });
}

const activeSession = { user: { id: 'biz-1' } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/staff', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns staff list for authenticated business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockStaffFindMany.mockResolvedValue([{ id: 'staff-1', fullName: 'John Doe', serviceAssignments: [] }]);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.staff).toHaveLength(1);
  });
});

describe('POST /api/staff', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 SUBSCRIPTION_REQUIRED when trial expired', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 403 PLAN_LIMIT_REACHED when at staff limit', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 10, services: 0 },
      });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('PLAN_LIMIT_REACHED');
  });

  it('returns 403 PLAN_LIMIT_REACHED for pro when at 50 staff profiles', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'pro',
        _count: { customers: 0, staff: 50, services: 0 },
      });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('PLAN_LIMIT_REACHED');
    expect(body.error).toMatch(/50\/50/);
  });

  it('returns 400 when fullName is missing', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      });
    const res = await POST(makeRequest({ role: 'stylist' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when staff text contains disallowed content', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      });
    const res = await POST(makeRequest({ fullName: 'Porn Star' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed content/i);
  });

  it('creates staff when active and under limit', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      });
    const fakeStaff = {
      id: 'staff-1',
      fullName: 'John Doe',
      businessId: 'biz-1',
      email: null,
      phone: null,
      role: null,
      active: true,
      workDays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: new Date(),
      updatedAt: new Date(),
      serviceAssignments: [],
    };
    mockTransaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        staff: {
          create: vi.fn().mockResolvedValue(fakeStaff),
          update: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue(fakeStaff),
        },
        staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(tx);
    });
    const res = await POST(makeRequest({ fullName: 'John Doe' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.staff.id).toBe('staff-1');
    expect(revalidateTag).toHaveBeenCalledWith('staff-biz-1', 'max');
  });

  it('creates staff for premium even with a very large existing staff count', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'premium',
        _count: { customers: 0, staff: 9999, services: 0 },
      });
    const fakeStaff = {
      id: 'staff-premium-1',
      fullName: 'Jane Doe',
      businessId: 'biz-1',
      email: null,
      phone: null,
      role: null,
      active: true,
      workDays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: new Date(),
      updatedAt: new Date(),
      serviceAssignments: [],
    };
    mockTransaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        staff: {
          create: vi.fn().mockResolvedValue(fakeStaff),
          update: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue(fakeStaff),
        },
        staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(tx);
    });

    const res = await POST(makeRequest({ fullName: 'Jane Doe' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.staff.id).toBe('staff-premium-1');
    expect(revalidateTag).toHaveBeenCalledWith('staff-biz-1', 'max');
  });

  it('stores custom work hours while leaving business-hour defaults implicit', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      });
    vi.mocked(prisma.businessHours.findUnique).mockResolvedValue({
      hours: {
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
    } as any);

    const createdStaff = {
      id: 'staff-1',
      fullName: 'John Doe',
      businessId: 'biz-1',
      email: null,
      phone: null,
      role: null,
      active: true,
      workDays: [1],
      workHours: { 1: { startTime: '10:00', endTime: '16:00' } },
      createdAt: new Date(),
      updatedAt: new Date(),
      serviceAssignments: [],
    };
    const createMock = vi.fn().mockResolvedValue(createdStaff);

    mockTransaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        staff: {
          create: createMock,
          update: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue(createdStaff),
        },
        staffService: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(tx);
    });

    const res = await POST(
      makeRequest({
        fullName: 'John Doe',
        workDays: [1],
        workHours: {
          1: { startTime: '10:00', endTime: '16:00' },
        },
      })
    );

    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workDays: [1],
          workHours: {
            1: { startTime: '10:00', endTime: '16:00' },
          },
        }),
      })
    );
    expect(revalidateTag).toHaveBeenCalledWith('staff-biz-1', 'max');
  });
});
