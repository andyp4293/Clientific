import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    staff: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
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
const mockStaffFindMany = prisma.staff.findMany as ReturnType<typeof vi.fn>;
const mockStaffCreate = prisma.staff.create as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown> = { fullName: 'John Doe' }) {
  return new NextRequest('http://localhost/api/staff', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const activeSession = { user: { id: 'biz-1' } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/staff', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns staff list for authenticated business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockStaffFindMany.mockResolvedValue([{ id: 'staff-1', fullName: 'John Doe' }]);
    const res = await GET();
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
        _count: { customers: 0, staff: 2, services: 0 },
      });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('PLAN_LIMIT_REACHED');
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

  it('creates staff when active and under limit', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        _count: { customers: 0, staff: 0, services: 0 },
      });
    const fakeStaff = { id: 'staff-1', fullName: 'John Doe', businessId: 'biz-1' };
    mockStaffCreate.mockResolvedValue(fakeStaff);
    const res = await POST(makeRequest({ fullName: 'John Doe' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.staff.id).toBe('staff-1');
  });
});
