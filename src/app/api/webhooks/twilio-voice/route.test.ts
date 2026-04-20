import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredWebhookBaseUrl: vi.fn(() => 'https://www.clientific.app'),
  getConfiguredAppBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));

import { prisma } from '@/lib/prisma';
import { POST } from './route';

const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindBusinessByPhone = prisma.business.findFirst as ReturnType<typeof vi.fn>;

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const baseBusiness = {
  id: 'biz-1',
  name: 'Test Salon',
  businessType: 'Salon',
  phone: '+15551234567',
  notifyNewBookingEmail: false,
  vapiPhoneNumberId: 'vapi-pn-1',
  vapiPhoneNumber: '+19084184377',
  publicId: 'AB-123456',
  street: '123 Main St',
  city: 'Howell',
  state: 'NJ',
  timezone: 'America/New_York',
  aiReceptionistGreeting: null,
  aiReceptionistPhone: '+15557654321',
  aiReceptionistFaq: [],
  aiReceptionistEnabled: true,
  aiReceptionistSpanishEnabled: false,
  services: [
    { id: 'svc-1', name: 'Gel Manicure', price: 45, duration: 45 },
  ],
  staff: [],
  businessHours: { hours: { 1: { isOpen: true, openTime: '09:00', closeTime: '17:00' } } },
  closureDates: [],
};

function buildRequest(formValues: Record<string, string>) {
  const formData = new FormData();
  Object.entries(formValues).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return new NextRequest(
    'https://www.clientific.app/api/webhooks/twilio-voice?publicId=AB-123456',
    {
      method: 'POST',
      body: formData,
    },
  );
}

describe('POST /api/webhooks/twilio-voice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        phoneCallProviderDetails: {
          twiml: '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Connected to Vapi</Say></Response>',
        },
      }),
    });
  });

  it('starts the English assistant immediately through the Twilio front door when spanish is disabled', async () => {
    mockFindBusiness.mockResolvedValue({
      ...baseBusiness,
      aiReceptionistSpanishEnabled: false,
    });

    const response = await POST(buildRequest({ CallSid: 'call-1', Caller: '+19087272437' }));
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('Connected to Vapi');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.vapi.ai/call',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const payload = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
    expect(payload.phoneNumberId).toBe('vapi-pn-1');
    expect(payload.phoneCallProviderBypassEnabled).toBe(true);
    expect(payload.customer).toEqual({ number: '+19087272437' });
    expect(payload.assistant.firstMessage).toBe('How can I help you today?');
  });

  it('adds a bilingual selector before handing the live call into Vapi when spanish is enabled', async () => {
    mockFindBusiness.mockResolvedValue({
      ...baseBusiness,
      aiReceptionistSpanishEnabled: true,
    });

    const response = await POST(buildRequest({ CallSid: 'call-2' }));
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('Hi, this is Test Salon.');
    expect(xml).toContain('For English, press 1. Or say English.');
    expect(xml).toContain('Hola, habla Test Salon.');
    expect(xml).toContain('Para espanol, oprima 2. O diga espanol.');
    expect(xml).toContain('input="speech dtmf"');
    expect(xml).toContain('numDigits="1"');
    expect(xml).toContain('hints="English, Ingles, Spanish, Espanol"');
    expect(xml).toContain('<Gather input="speech dtmf"');
    expect(xml).toContain('<Say voice="Polly.Joanna">Hi, this is Test Salon.');
    expect(xml.indexOf('<Gather input="speech dtmf"')).toBeLessThan(
      xml.indexOf('<Say voice="Polly.Joanna">Hi, this is Test Salon.'),
    );
    expect(xml).toContain("I'll keep us in English.");
    expect(xml).toContain(
      'action="https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&amp;callSid=call-2"',
    );
    expect(xml).toContain(
      '<Redirect method="POST">https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&amp;callSid=call-2&amp;lang=en</Redirect>',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('can fall back to the dialed Twilio number when publicId is missing', async () => {
    mockFindBusiness.mockResolvedValue(null);
    mockFindBusinessByPhone.mockResolvedValue({
      ...baseBusiness,
      aiReceptionistSpanishEnabled: true,
    });

    const response = await POST(
      new NextRequest('https://www.clientific.app/api/webhooks/twilio-voice', {
        method: 'POST',
        body: (() => {
          const formData = new FormData();
          formData.set('CallSid', 'call-3');
          formData.set('To', '+19084184377');
          return formData;
        })(),
      }),
    );

    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('For English, press 1.');
    expect(mockFindBusinessByPhone).toHaveBeenCalledWith({
      where: {
        vapiPhoneNumber: '9084184377',
      },
      select: expect.any(Object),
    });
  });
});
