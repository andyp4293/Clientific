import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
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

// Mock global fetch for Vapi API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET, PATCH } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockBusinessUpdate = prisma.business.update as ReturnType<typeof vi.fn>;

// Business routes use session.user.id as businessId directly
const activeSession = { user: { id: 'biz-1' } };
const fakeBusiness = {
  id: 'biz-1',
  name: 'Test Salon',
  slug: 'test-salon',
  email: 'owner@test.com',
  subscriptionStatus: 'active',
  trialEndsAt: null,
  aiReceptionistEnabled: false,
  vapiPhoneNumberId: null,
  phone: '5551234567',
};

function makePatchRequest(body: Record<string, unknown> = { name: 'Updated Salon' }) {
  return new NextRequest('http://localhost/api/business', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
});

describe('GET /api/business', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/business'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when business not found', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/business'));
    expect(res.status).toBe(404);
  });

  it('returns business data', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue(fakeBusiness);
    const res = await GET(new NextRequest('http://localhost/api/business'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.business.id).toBe('biz-1');
  });
});

describe('PATCH /api/business', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 SUBSCRIPTION_REQUIRED when subscription inactive', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'canceled', trialEndsAt: null });
    const res = await PATCH(makePatchRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 404 when business not found after subscription check', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce(null); // current business fetch returns null
    const res = await PATCH(makePatchRequest());
    expect(res.status).toBe(404);
  });

  it('updates business name successfully', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness }); // current fetch
    const updatedBusiness = { ...fakeBusiness, name: 'Updated Salon' };
    mockBusinessUpdate.mockResolvedValue(updatedBusiness);
    const res = await PATCH(makePatchRequest({ name: 'Updated Salon' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.business.name).toBe('Updated Salon');
  });

  it('returns 400 when profile text contains disallowed content', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await PATCH(makePatchRequest({ name: 'Porn Palace' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed content/i);
  });

  it('does not call Vapi when VAPI_PRIVATE_KEY is not set', async () => {
    delete process.env.VAPI_PRIVATE_KEY;
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness });
    mockBusinessUpdate.mockResolvedValue({ ...fakeBusiness });
    await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
