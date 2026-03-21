import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    checkIn: { findMany: vi.fn(), create: vi.fn() },
    customer: { update: vi.fn() },
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
vi.mock('@/lib/segment', () => ({ updateCustomerSegment: vi.fn() }));
vi.mock('@/lib/timezone', () => ({ businessDayStart: vi.fn((date: string) => new Date(date)) }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { updateCustomerSegment } from '@/lib/segment';
import { GET, POST } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCheckInFindMany = prisma.checkIn.findMany as ReturnType<typeof vi.fn>;
const mockCheckInCreate = prisma.checkIn.create as ReturnType<typeof vi.fn>;
const mockCustomerUpdate = prisma.customer.update as ReturnType<typeof vi.fn>;
const mockUpdateSegment = updateCustomerSegment as ReturnType<typeof vi.fn>;

// Checkins use session.user.businessId
const activeSession = { user: { businessId: 'biz-1' } };
const fakeBusiness = { id: 'biz-1', timezone: 'America/New_York' };

function makeRequest(body: Record<string, unknown> = { customerId: 'cust-1' }) {
  return new Request('http://localhost/api/checkins', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  // updateCustomerSegment is called with .catch() so needs to return a Promise
  mockUpdateSegment.mockResolvedValue(undefined);
});

describe('GET /api/checkins', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/checkins'));
    expect(res.status).toBe(401);
  });

  it('returns checkins for authenticated business', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue(fakeBusiness);
    mockCheckInFindMany.mockResolvedValue([{ id: 'ci-1', customerId: 'cust-1' }]);
    const res = await GET(new Request('http://localhost/api/checkins'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkIns).toHaveLength(1);
    expect(body.timezone).toBe('America/New_York');
  });
});

describe('POST /api/checkins', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 SUBSCRIPTION_REQUIRED when subscription expired', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({
      subscriptionStatus: 'canceled',
      trialEndsAt: null,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 400 when customerId is missing', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('creates a check-in and updates the customer visit history', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const fakeCheckIn = {
      id: 'ci-1',
      customerId: 'cust-1',
      customer: { id: 'cust-1' },
      service: null,
      staff: null,
    };
    mockCheckInCreate.mockResolvedValue(fakeCheckIn);
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-1' });

    const res = await POST(makeRequest({ customerId: 'cust-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkIn.id).toBe('ci-1');
    expect(mockCustomerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cust-1' } })
    );
  });

  it('stores amount spent when provided', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const fakeCheckIn = {
      id: 'ci-2',
      customerId: 'cust-1',
      amountSpent: 50,
      customer: { id: 'cust-1' },
      service: null,
      staff: null,
    };
    mockCheckInCreate.mockResolvedValue(fakeCheckIn);
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-1' });

    const res = await POST(makeRequest({ customerId: 'cust-1', amountSpent: 50 }));
    expect(res.status).toBe(200);
    expect(mockCheckInCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountSpent: 50 }),
      })
    );
  });
});
