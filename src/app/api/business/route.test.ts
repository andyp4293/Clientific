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

const twilioMocks = vi.hoisted(() => {
  const mockTollFreeList = vi.fn();
  const mockIncomingCreate = vi.fn();
  const mockIncomingList = vi.fn();
  const mockIncomingUpdate = vi.fn();
  const mockIncomingRemove = vi.fn();

  const mockIncomingPhoneNumbers = Object.assign(
    vi.fn(() => ({ update: mockIncomingUpdate, remove: mockIncomingRemove })),
    {
      create: mockIncomingCreate,
      list: mockIncomingList,
    }
  );

  const mockTwilioFactory = vi.fn(() => ({
    availablePhoneNumbers: vi.fn(() => ({
      tollFree: { list: mockTollFreeList },
    })),
    incomingPhoneNumbers: mockIncomingPhoneNumbers,
  }));

  return {
    mockTollFreeList,
    mockIncomingCreate,
    mockIncomingList,
    mockIncomingUpdate,
    mockIncomingRemove,
    mockIncomingPhoneNumbers,
    mockTwilioFactory,
  };
});

const {
  mockTollFreeList,
  mockIncomingCreate,
  mockIncomingList,
  mockIncomingUpdate,
  mockIncomingRemove,
  mockIncomingPhoneNumbers,
  mockTwilioFactory,
} = twilioMocks;

vi.mock('twilio', () => ({
  default: twilioMocks.mockTwilioFactory,
}));

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
  mockTollFreeList.mockResolvedValue([{ phoneNumber: '+18557654989' }]);
  mockIncomingCreate.mockResolvedValue({ sid: 'PN123', phoneNumber: '+18557654989' });
  mockIncomingList.mockResolvedValue([]);
  mockIncomingUpdate.mockResolvedValue({ sid: 'PN123' });
  mockIncomingRemove.mockResolvedValue(true);

  process.env.TWILIO_ACCOUNT_SID = 'AC_TEST';
  process.env.TWILIO_AUTH_TOKEN = 'AUTH_TEST';
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

  it('provisions Twilio toll-free and imports into Vapi when enabling AI receptionist', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness, smsAiPhoneNumber: null, vapiPhoneNumberId: null });

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
      smsAiPhoneNumber: '+18557654989',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(200);
    expect(mockTollFreeList).toHaveBeenCalledWith({ smsEnabled: true, voiceEnabled: true, limit: 1 });
    expect(mockIncomingCreate).toHaveBeenCalledWith({ phoneNumber: '+18557654989' });
    expect(mockIncomingPhoneNumbers).toHaveBeenCalledWith('PN123');
    expect(mockIncomingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ smsUrl: expect.stringContaining('/api/webhooks/twilio-sms') })
    );

    const createPayload = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(createPayload.provider).toBe('twilio');
    expect(createPayload.number).toBe('+18557654989');
    expect(createPayload.smsEnabled).toBe(false);

    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vapiPhoneNumberId: 'vapi-pn-1',
          vapiPhoneNumber: '+18557654989',
          smsAiPhoneNumber: '+18557654989',
        }),
      })
    );
  });

  it('rolls back purchased Twilio number when Vapi import fails', async () => {
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
    expect(mockIncomingPhoneNumbers).toHaveBeenCalledWith('PN123');
    expect(mockIncomingRemove).toHaveBeenCalled();
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('releases Twilio and clears shared SMS number when disabling AI receptionist', async () => {
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
    mockIncomingList.mockResolvedValueOnce([{ sid: 'PN123' }]);
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
    expect(mockIncomingList).toHaveBeenCalledWith({ phoneNumber: '+18557654989', limit: 1 });
    expect(mockIncomingPhoneNumbers).toHaveBeenCalledWith('PN123');
    expect(mockIncomingRemove).toHaveBeenCalled();
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
});
