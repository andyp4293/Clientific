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

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET, PATCH } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockBusinessUpdate = prisma.business.update as ReturnType<typeof vi.fn>;

const activeSession = { user: { id: 'biz-1' } };
const fakeBusiness = {
  id: 'biz-1',
  name: 'Test Salon',
  slug: 'test-salon',
  email: 'owner@test.com',
  subscriptionStatus: 'active',
  trialEndsAt: null,
  aiReceptionistEnabled: false,
  smsAiEnabled: false,
  smsAiPhoneNumber: null,
  smsAiGreeting: null,
  vapiPhoneNumberId: null,
  vapiPhoneNumber: null,
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
  delete process.env.VAPI_PRIVATE_KEY;
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
      .mockResolvedValueOnce(null);
    const res = await PATCH(makePatchRequest());
    expect(res.status).toBe(404);
  });

  it('updates business name successfully', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness });
    const updatedBusiness = { ...fakeBusiness, name: 'Updated Salon' };
    mockBusinessUpdate.mockResolvedValue(updatedBusiness);

    const res = await PATCH(makePatchRequest({ name: 'Updated Salon' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.business.name).toBe('Updated Salon');
  });

  it('returns 400 when profile text contains disallowed content', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
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

  it('provisions a Vapi-managed number when enabling AI receptionist', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        smsAiEnabled: false,
        smsAiPhoneNumber: '+15559990000',
        vapiPhoneNumberId: null,
      });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'vapi-pn-1', number: '+18557654989' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ server: { url: 'https://clientific.app/api/webhooks/vapi' } }),
      });

    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      aiReceptionistEnabled: true,
      vapiPhoneNumberId: 'vapi-pn-1',
      vapiPhoneNumber: '+18557654989',
      smsAiEnabled: true,
      smsAiPhoneNumber: '+18557654989',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(200);

    const createPayload = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(createPayload.provider).toBe('vapi');

    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vapiPhoneNumberId: 'vapi-pn-1',
          vapiPhoneNumber: '+18557654989',
          smsAiEnabled: true,
          smsAiPhoneNumber: '+18557654989',
        }),
      })
    );
  });

  it('hydrates a provisioned Vapi number when the create response omits number', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        smsAiEnabled: false,
        smsAiPhoneNumber: null,
        vapiPhoneNumberId: null,
        vapiPhoneNumber: null,
      });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'vapi-pn-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ server: { url: 'https://clientific.app/api/webhooks/vapi' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'vapi-pn-1', number: '+18557654989' }),
      });

    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      aiReceptionistEnabled: true,
      vapiPhoneNumberId: 'vapi-pn-1',
      vapiPhoneNumber: '+18557654989',
      smsAiEnabled: true,
      smsAiPhoneNumber: '+18557654989',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/phone-number/vapi-pn-1'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vapiPhoneNumberId: 'vapi-pn-1',
          vapiPhoneNumber: '+18557654989',
          smsAiEnabled: true,
          smsAiPhoneNumber: '+18557654989',
        }),
      })
    );
  });

  it('returns 500 and does not persist when Vapi number provisioning fails', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness, smsAiPhoneNumber: null, vapiPhoneNumberId: null });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'vapi boom',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(500);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('clears AI number linkage when disabling AI receptionist', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        aiReceptionistEnabled: true,
        vapiPhoneNumberId: 'vapi-pn-1',
        vapiPhoneNumber: '+18557654989',
        smsAiEnabled: true,
        smsAiPhoneNumber: '+18557654989',
      });

    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });
    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      aiReceptionistEnabled: false,
      vapiPhoneNumberId: null,
      vapiPhoneNumber: null,
      smsAiEnabled: false,
      smsAiPhoneNumber: null,
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: false }));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/phone-number/vapi-pn-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vapiPhoneNumberId: null,
          vapiPhoneNumber: null,
          smsAiPhoneNumber: null,
          smsAiEnabled: false,
        }),
      })
    );
  });

  it('re-syncs existing AI number into SMS settings when already enabled', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        aiReceptionistEnabled: true,
        vapiPhoneNumberId: 'vapi-pn-1',
        vapiPhoneNumber: '+18557654989',
        smsAiEnabled: false,
        smsAiPhoneNumber: '+15559990000',
      });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ server: { url: 'https://clientific.app/api/webhooks/vapi' } }),
    });

    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      aiReceptionistEnabled: true,
      vapiPhoneNumberId: 'vapi-pn-1',
      vapiPhoneNumber: '+18557654989',
      smsAiEnabled: true,
      smsAiPhoneNumber: '+18557654989',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsAiEnabled: true,
          smsAiPhoneNumber: '+18557654989',
        }),
      })
    );
  });

  it('backfills missing local Vapi number when synced number is returned', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        aiReceptionistEnabled: true,
        vapiPhoneNumberId: 'vapi-pn-1',
        vapiPhoneNumber: null,
        smsAiEnabled: false,
        smsAiPhoneNumber: null,
      });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        number: '+18557654989',
        server: { url: 'https://clientific.app/api/webhooks/vapi' },
      }),
    });

    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      aiReceptionistEnabled: true,
      vapiPhoneNumberId: 'vapi-pn-1',
      vapiPhoneNumber: '+18557654989',
      smsAiEnabled: true,
      smsAiPhoneNumber: '+18557654989',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vapiPhoneNumber: '+18557654989',
          smsAiEnabled: true,
          smsAiPhoneNumber: '+18557654989',
        }),
      })
    );
  });

  it('returns 500 when synced AI number is still missing after fetch fallback', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        aiReceptionistEnabled: true,
        vapiPhoneNumberId: 'vapi-pn-1',
        vapiPhoneNumber: null,
        smsAiEnabled: false,
        smsAiPhoneNumber: null,
      });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ server: { url: 'https://clientific.app/api/webhooks/vapi' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'vapi-pn-1', number: null }),
      });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(500);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/phone-number/vapi-pn-1'),
      expect.objectContaining({ method: 'GET' })
    );
  });
});
