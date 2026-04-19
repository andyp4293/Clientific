import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import { GET, PATCH } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockRequireActiveSubscription = requireActiveSubscription as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockUpdateBusiness = prisma.business.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
  mockRequireActiveSubscription.mockResolvedValue(null);
  delete process.env.VAPI_PRIVATE_KEY;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
});

function makeBusiness(overrides: Record<string, unknown> = {}) {
  return {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    phone: '+15551234567',
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'US',
    subscriptionPlan: 'pro',
    billingProvider: 'stripe',
    aiReceptionistEnabled: true,
    aiReceptionistSpanishEnabled: false,
    aiReceptionistPhone: '+15557654321',
    aiReceptionistGreeting: 'Thanks for calling Clientific Studio.',
    aiReceptionistFaq: [{ question: 'Do you take walk-ins?', answer: 'Yes.' }],
    smsAiEnabled: true,
    smsAiPhoneNumber: '+18885550123',
    smsAiGreeting: 'Text us to book.',
    vapiPhoneNumberId: 'pn_123',
    vapiPhoneNumber: '+18885550123',
    ...overrides,
  };
}

describe('GET /api/mobile/ai-receptionist', () => {
  it('returns the native AI receptionist summary', async () => {
    mockFindBusiness.mockResolvedValue(makeBusiness());

    const response = await GET(new Request('https://www.clientific.app/api/mobile/ai-receptionist'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hasAccess).toBe(true);
    expect(body.billingProvider).toBe('stripe');
    expect(body.unifiedNumber).toBe('+18885550123');
    expect(body.aiReceptionistSpanishEnabled).toBe(false);
    expect(body.aiReceptionistFaq[0]).toMatchObject({
      question: 'Do you take walk-ins?',
      answer: 'Yes.',
    });
  });
});

describe('PATCH /api/mobile/ai-receptionist', () => {
  it('updates AI receptionist fields for the native app without web session auth', async () => {
    mockFindBusiness.mockResolvedValue(makeBusiness({ vapiPhoneNumberId: null, vapiPhoneNumber: null, smsAiPhoneNumber: null, smsAiEnabled: false }));
    mockUpdateBusiness.mockResolvedValue(
      makeBusiness({
        aiReceptionistSpanishEnabled: true,
        aiReceptionistPhone: '+15551112222',
        aiReceptionistGreeting: 'Hello from the studio.',
        aiReceptionistFaq: [{ question: 'Parking?', answer: 'Street parking is available.' }],
        smsAiGreeting: 'Text us any time.',
        vapiPhoneNumberId: null,
        vapiPhoneNumber: null,
        smsAiPhoneNumber: null,
        smsAiEnabled: false,
      }),
    );

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/ai-receptionist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiReceptionistEnabled: true,
          aiReceptionistSpanishEnabled: true,
          aiReceptionistPhone: '(555) 111-2222',
          aiReceptionistGreeting: 'Hello from the studio.',
          aiReceptionistFaq: [{ question: 'Parking?', answer: 'Street parking is available.' }],
          smsAiGreeting: 'Text us any time.',
        }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiReceptionistEnabled: true,
          aiReceptionistSpanishEnabled: true,
          aiReceptionistPhone: '5551112222',
          aiReceptionistGreeting: 'Hello from the studio.',
          aiReceptionistFaq: [{ question: 'Parking?', answer: 'Street parking is available.' }],
          smsAiGreeting: 'Text us any time.',
        }),
      }),
    );
    expect(body.aiReceptionistPhone).toBe('+15551112222');
  });

  it('rejects a non-boolean spanish toggle', async () => {
    mockFindBusiness.mockResolvedValue(makeBusiness());

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/ai-receptionist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiReceptionistSpanishEnabled: 'yes' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Spanish toggle must be true or false',
    });
  });
});
