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
    STARTER: { name: 'Starter', limits: { customers: 100, staff: 10, services: 10 } },
    PRO: { name: 'Pro', limits: { customers: 1000, staff: 50, services: 50 } },
    PREMIUM: { name: 'Premium', limits: { customers: Infinity, staff: Infinity, services: Infinity } },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

const mockTwilioAvailableList = vi.fn();
const mockTwilioAvailableLocalList = vi.fn();
const mockTwilioIncomingCreate = vi.fn();
const mockTwilioIncomingUpdate = vi.fn();
const mockTwilioIncomingList = vi.fn();
const mockTwilioIncomingRemove = vi.fn();

vi.mock('twilio', () => {
  const twilioFactory = vi.fn(() => {
    const incomingPhoneNumbers = ((_: string) => ({
      update: mockTwilioIncomingUpdate,
      remove: mockTwilioIncomingRemove,
    })) as any;
    incomingPhoneNumbers.create = mockTwilioIncomingCreate;
    incomingPhoneNumbers.list = mockTwilioIncomingList;

    return {
      availablePhoneNumbers: vi.fn(() => ({
        local: { list: mockTwilioAvailableLocalList },
        tollFree: { list: mockTwilioAvailableList },
      })),
      incomingPhoneNumbers,
    };
  });

  return { default: twilioFactory };
});

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

import { getServerSession } from 'next-auth';
import { revalidateTag } from 'next/cache';
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
  subscriptionPlan: 'pro',
  ownerPhone: null,
  subscriptionStatus: 'active',
  trialEndsAt: null,
  aiReceptionistEnabled: false,
  aiReceptionistSpanishEnabled: false,
  aiReceptionistPhone: null,
  aiReceptionistGreeting: null,
  aiReceptionistFaq: null,
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
  delete (globalThis as typeof globalThis & {
    __clientificSharedPlatformSmsWebhookCache?: unknown;
  }).__clientificSharedPlatformSmsWebhookCache;

  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  delete process.env.VAPI_PRIVATE_KEY;
  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'twilio_test_token';

  mockTwilioAvailableLocalList.mockResolvedValue([]);
  mockTwilioAvailableList.mockResolvedValue([{ phoneNumber: '+18557654989' }]);
  mockTwilioIncomingCreate.mockResolvedValue({ sid: 'PN_test_1', phoneNumber: '+18557654989' });
  mockTwilioIncomingUpdate.mockResolvedValue({});
  mockTwilioIncomingList.mockResolvedValue([
    {
      sid: 'PN_test_1',
      smsUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
      smsMethod: 'POST',
    },
  ]);
  mockTwilioIncomingRemove.mockResolvedValue({});
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
    expect(body.business.aiReceptionistSpanishEnabled).toBe(false);
  });

  it('repairs the shared platform sms webhook when it is missing during business fetch', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValue(fakeBusiness);
    mockTwilioIncomingList.mockResolvedValueOnce([{ sid: 'PN_shared', smsUrl: null, smsMethod: null }]);

    const res = await GET(new NextRequest('http://localhost/api/business'));

    expect(res.status).toBe(200);
    expect(mockTwilioIncomingUpdate).toHaveBeenCalledWith({
      smsUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
      smsMethod: 'POST',
    });
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
    expect(revalidateTag).toHaveBeenCalledWith('business-biz-1', 'max');
  });

  it('returns 403 when a Starter account tries to update AI receptionist settings', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness, subscriptionPlan: 'starter' });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      code: 'PLAN_UPGRADE_REQUIRED',
    });
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('saves the spanish caller toggle for eligible plans', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness, subscriptionPlan: 'pro' });
    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      subscriptionPlan: 'pro',
      aiReceptionistSpanishEnabled: true,
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistSpanishEnabled: true }));

    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiReceptionistSpanishEnabled: true,
        }),
      }),
    );
  });

  it.each([
    ['googleReviewUrl', 'https://g.page/abc-nails/review'],
    ['facebookPageUrl', 'https://www.facebook.com/abcnails'],
    ['yelpUrl', 'https://www.yelp.com/biz/abc-nails'],
    ['instagramUrl', 'https://www.instagram.com/abcnails'],
  ] as const)(
    'allows Starter accounts to save %s when unchanged AI fields are present',
    async (field, value) => {
      mockSession.mockResolvedValue(activeSession);
      mockBusiness
        .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
        .mockResolvedValueOnce({ ...fakeBusiness, subscriptionPlan: 'starter' });

      mockBusinessUpdate.mockResolvedValue({
        ...fakeBusiness,
        subscriptionPlan: 'starter',
        [field]: value,
      });

      const res = await PATCH(
        makePatchRequest({
          [field]: value,
          aiReceptionistEnabled: false,
          aiReceptionistPhone: null,
          aiReceptionistGreeting: null,
          aiReceptionistFaq: null,
          smsAiEnabled: false,
          smsAiPhoneNumber: null,
          smsAiGreeting: null,
        })
      );

      expect(res.status).toBe(200);
      expect(mockBusinessUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            [field]: value,
          }),
        })
      );
    }
  );

  it('normalizes the transfer-to phone number before saving settings', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness });
    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      aiReceptionistPhone: '+19087272437',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistPhone: '(908) 727-2437' }));

    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiReceptionistPhone: '9087272437',
        }),
      })
    );
  });

  it('normalizes the personal owner phone before saving settings', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness });
    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      ownerPhone: '+19087272437',
    });

    const res = await PATCH(makePatchRequest({ ownerPhone: '(908) 727-2437' }));

    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerPhone: '9087272437',
        }),
      })
    );
  });

  it('rejects invalid transfer-to phone numbers instead of saving broken Vapi forwarding data', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness });

    const res = await PATCH(makePatchRequest({ aiReceptionistPhone: 'front desk' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/transfer-to phone number/i);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('rejects using the AI receptionist number itself as the transfer destination', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        vapiPhoneNumber: '+19087272437',
      });

    const res = await PATCH(makePatchRequest({ aiReceptionistPhone: '(908) 727-2437' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cannot be the ai receptionist number itself/i);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when profile text contains disallowed content', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness.mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null });
    const res = await PATCH(makePatchRequest({ name: 'Porn Palace' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/disallowed content/i);
  });

  it('allows null public profile text fields when saving settings', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness });
    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      publicProfileHeadline: null,
      publicProfileAbout: null,
      notifyNewBookingEmail: true,
    });

    const res = await PATCH(makePatchRequest({
      publicProfileHeadline: null,
      publicProfileAbout: null,
      notifyNewBookingEmail: true,
    }));

    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicProfileHeadline: null,
          publicProfileAbout: null,
          notifyNewBookingEmail: true,
        }),
      })
    );
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
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
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
    expect(mockTwilioIncomingUpdate).toHaveBeenCalledWith({
      voiceUrl: 'https://api.vapi.ai/twilio/inbound_call',
      voiceMethod: 'POST',
      statusCallback: 'https://api.vapi.ai/twilio/status',
      statusCallbackMethod: 'POST',
      smsUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
      smsMethod: 'POST',
    });

    const createPayload = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(createPayload.provider).toBe('twilio');
    expect(createPayload.number).toBe('+18557654989');
    expect(createPayload.twilioAccountSid).toBe('AC_test');
    expect(createPayload.twilioAuthToken).toBe('twilio_test_token');

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

  it('skips Twilio SMS webhook setup for localhost app URLs and still enables AI receptionist', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        smsAiEnabled: false,
        smsAiPhoneNumber: null,
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
        json: async () => ({ server: { url: 'http://localhost:3000/api/webhooks/vapi' } }),
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
    expect(mockTwilioIncomingUpdate).toHaveBeenCalledWith({
      voiceUrl: 'https://api.vapi.ai/twilio/inbound_call',
      voiceMethod: 'POST',
      statusCallback: 'https://api.vapi.ai/twilio/status',
      statusCallbackMethod: 'POST',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[twilio] Skipping sms webhook configuration because app URL is not publicly reachable:',
      'http://localhost:3000'
    );
    warnSpy.mockRestore();
  });

  it('keeps AI receptionist enable successful when Twilio rejects webhook URL with 21402', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';
    mockTwilioIncomingUpdate.mockRejectedValueOnce({
      status: 400,
      code: 21402,
      message: 'SmsUrl is not valid',
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        smsAiEnabled: false,
        smsAiPhoneNumber: null,
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
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
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
    expect(mockTwilioIncomingUpdate).toHaveBeenNthCalledWith(1, {
      voiceUrl: 'https://api.vapi.ai/twilio/inbound_call',
      voiceMethod: 'POST',
      statusCallback: 'https://api.vapi.ai/twilio/status',
      statusCallbackMethod: 'POST',
      smsUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
      smsMethod: 'POST',
    });
    expect(mockTwilioIncomingUpdate).toHaveBeenNthCalledWith(2, {
      voiceUrl: 'https://api.vapi.ai/twilio/inbound_call',
      voiceMethod: 'POST',
      statusCallback: 'https://api.vapi.ai/twilio/status',
      statusCallbackMethod: 'POST',
    });
    expect(mockBusinessUpdate).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[twilio] Skipping sms webhook configuration because Twilio rejected the SMS URL:',
      'https://www.clientific.app/api/webhooks/twilio-sms'
    );
    warnSpy.mockRestore();
  });

  it('rolls back the purchased Twilio number when webhook setup fails with a non-21402 error', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';
    mockTwilioIncomingUpdate.mockRejectedValueOnce({
      status: 500,
      code: 20003,
      message: 'Auth error',
    });

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        smsAiEnabled: false,
        smsAiPhoneNumber: null,
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
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
      });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(500);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/phone-number/vapi-pn-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(mockTwilioIncomingRemove).toHaveBeenCalled();
  });

  it('returns 500 when Twilio credentials are missing while enabling AI receptionist', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({ ...fakeBusiness, vapiPhoneNumberId: null });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(500);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('tries matching business area code before falling back to toll-free', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        phone: '4155551234',
        smsAiEnabled: false,
        smsAiPhoneNumber: null,
        vapiPhoneNumberId: null,
      });

    mockTwilioAvailableLocalList.mockResolvedValueOnce([{ phoneNumber: '+14155550123' }]);
    mockTwilioIncomingCreate.mockResolvedValueOnce({
      sid: 'PN_local_1',
      phoneNumber: '+14155550123',
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'vapi-pn-1', number: '+14155550123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
      });

    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      aiReceptionistEnabled: true,
      vapiPhoneNumberId: 'vapi-pn-1',
      vapiPhoneNumber: '+14155550123',
      smsAiEnabled: true,
      smsAiPhoneNumber: '+14155550123',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(200);
    expect(mockTwilioAvailableLocalList).toHaveBeenCalledWith({
      areaCode: 415,
      smsEnabled: true,
      voiceEnabled: true,
      limit: 1,
    });
    expect(mockTwilioAvailableList).not.toHaveBeenCalled();

    const createPayload = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(createPayload.number).toBe('+14155550123');
  });

  it('repairs Twilio voice routing for an existing AI number when saving settings', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    mockSession.mockResolvedValue(activeSession);
    mockBusiness
      .mockResolvedValueOnce({ subscriptionStatus: 'active', trialEndsAt: null })
      .mockResolvedValueOnce({
        ...fakeBusiness,
        aiReceptionistEnabled: true,
        vapiPhoneNumberId: 'vapi-pn-1',
        vapiPhoneNumber: '+19084184377',
        smsAiEnabled: true,
        smsAiPhoneNumber: '+19084184377',
      });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'vapi-pn-1',
        number: '+19084184377',
        server: { url: 'https://www.clientific.app/api/webhooks/vapi' },
      }),
    });

    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      name: 'Updated Salon',
      aiReceptionistEnabled: true,
      vapiPhoneNumberId: 'vapi-pn-1',
      vapiPhoneNumber: '+19084184377',
      smsAiEnabled: true,
      smsAiPhoneNumber: '+19084184377',
    });

    const res = await PATCH(makePatchRequest({ name: 'Updated Salon' }));

    expect(res.status).toBe(200);
    expect(mockTwilioIncomingList).toHaveBeenCalledWith({
      phoneNumber: '+19084184377',
      limit: 1,
    });
    expect(mockTwilioIncomingUpdate).toHaveBeenCalledWith({
      voiceUrl: 'https://api.vapi.ai/twilio/inbound_call',
      voiceMethod: 'POST',
      statusCallback: 'https://api.vapi.ai/twilio/status',
      statusCallbackMethod: 'POST',
      smsUrl: 'https://www.clientific.app/api/webhooks/twilio-sms',
      smsMethod: 'POST',
    });
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
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
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

  it('uses the Twilio number when Vapi is still activating', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    const timeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: (...args: any[]) => unknown) => {
        fn();
        return 0 as any;
      }) as any);

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
        json: async () => ({ id: 'vapi-pn-1', status: 'activating' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'vapi-pn-1', status: 'activating', number: null }),
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
          vapiPhoneNumberId: 'vapi-pn-1',
          vapiPhoneNumber: '+18557654989',
          smsAiEnabled: true,
          smsAiPhoneNumber: '+18557654989',
        }),
      })
    );

    timeoutSpy.mockRestore();
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

    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: false, status: 404 });
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
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/phone-number/vapi-pn-1'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(mockTwilioIncomingList).toHaveBeenCalledWith({
      phoneNumber: '+18557654989',
      limit: 1,
    });
    expect(mockTwilioIncomingRemove).toHaveBeenCalled();
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

  it('returns 500 and does not disable when Vapi number deletion is not confirmed', async () => {
    process.env.VAPI_PRIVATE_KEY = 'vapi_test_key';

    const timeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: (...args: any[]) => unknown) => {
        fn();
        return 0 as any;
      }) as any);

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

    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'vapi-pn-1', number: '+18557654989' }),
      });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: false }));

    expect(res.status).toBe(500);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
    timeoutSpy.mockRestore();
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
      json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
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
        server: { url: 'https://www.clientific.app/api/webhooks/vapi' },
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

  it('provisions a replacement number when synced AI number is missing after fetch fallback', async () => {
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
        ok: false,
        status: 404,
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ id: 'vapi-pn-1', number: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'vapi-pn-2', number: '+18557654989' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
      });

    mockBusinessUpdate.mockResolvedValue({
      ...fakeBusiness,
      aiReceptionistEnabled: true,
      vapiPhoneNumberId: 'vapi-pn-2',
      vapiPhoneNumber: '+18557654989',
      smsAiEnabled: true,
      smsAiPhoneNumber: '+18557654989',
    });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(200);
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vapiPhoneNumberId: 'vapi-pn-2',
          vapiPhoneNumber: '+18557654989',
          smsAiEnabled: true,
          smsAiPhoneNumber: '+18557654989',
        }),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/phone-number/vapi-pn-1'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns 500 when replacement provisioning fails after stale-id recovery', async () => {
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
        ok: false,
        status: 404,
        json: async () => ({ server: { url: 'https://www.clientific.app/api/webhooks/vapi' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ id: 'vapi-pn-1', number: null }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'vapi boom',
      });

    const res = await PATCH(makePatchRequest({ aiReceptionistEnabled: true }));

    expect(res.status).toBe(500);
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });
});
