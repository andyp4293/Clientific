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

import { prisma } from '@/lib/prisma';
import { POST } from './route';

const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindBusinessByPhone = prisma.business.findFirst as ReturnType<typeof vi.fn>;
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function buildRequest(url: string, formValues: Record<string, string>) {
  const formData = new FormData();
  Object.entries(formValues).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return new NextRequest(url, {
    method: 'POST',
    body: formData,
  });
}

const business = {
  id: 'biz-1',
  name: 'Test Salon',
  businessType: 'Salon',
  phone: '+15551234567',
  notifyNewBookingEmail: false,
  vapiPhoneNumberId: 'vapi-pn-1',
  vapiPhoneNumber: '+19084184377',
  street: '123 Main St',
  city: 'Howell',
  state: 'NJ',
  timezone: 'America/New_York',
  publicId: 'AB-123456',
  aiReceptionistEnabled: true,
  aiReceptionistSpanishEnabled: true,
  aiReceptionistPhone: '+15557654321',
  aiReceptionistFaq: [{ question: 'Do you take walk-ins?', answer: 'Yes, if availability opens up.' }],
  services: [{ id: 'svc-1', name: 'Gel Manicure', price: 45, duration: 45 }],
  staff: [],
  businessHours: { hours: { 1: { isOpen: true, openTime: '09:00', closeTime: '17:00' } } },
  closureDates: [],
};

describe('POST /api/webhooks/twilio-voice/process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindBusiness.mockResolvedValue(business);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        phoneCallProviderDetails: {
          twiml: '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Connected to Vapi</Say></Response>',
        },
      }),
    });
  });

  it('hands a spanish digit choice into a spanish Vapi assistant', async () => {
    const response = await POST(
      buildRequest(
        'https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&callSid=call-es-choice',
        { Digits: '2', Caller: '+19087272437' },
      ),
    );

    const xml = await response.text();
    const payload = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);

    expect(response.status).toBe(200);
    expect(xml).toContain('Connected to Vapi');
    expect(payload.phoneNumberId).toBe('vapi-pn-1');
    expect(payload.customer).toEqual({ number: '+19087272437' });
    expect(payload.assistant.firstMessage).toBe('Como puedo ayudarle hoy?');
  });

  it('routes directly into spanish when the caller starts in spanish', async () => {
    const response = await POST(
      buildRequest(
        'https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&callSid=call-es-inferred',
        { SpeechResult: 'Hola, necesito una cita manana por la tarde' },
      ),
    );

    const xml = await response.text();
    const payload = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);

    expect(response.status).toBe(200);
    expect(xml).toContain('Connected to Vapi');
    expect(payload.assistant.firstMessage).toBe('Como puedo ayudarle hoy?');
    expect(payload.assistant.transcriber.language).toBe('multi');
  });

  it('defaults to english handoff when no choice is captured', async () => {
    const response = await POST(
      buildRequest(
        'https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&callSid=call-en-default',
        {},
      ),
    );

    const xml = await response.text();
    const payload = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);

    expect(response.status).toBe(200);
    expect(xml).toContain('Connected to Vapi');
    expect(payload.assistant.firstMessage).toBe('How can I help you today?');
    expect(payload.assistant.transcriber.language).toBe('en');
  });

  it('can recover the business by dialed number when publicId is unavailable', async () => {
    mockFindBusiness.mockResolvedValue(null);
    mockFindBusinessByPhone.mockResolvedValue(business);

    const response = await POST(
      buildRequest(
        'https://www.clientific.app/api/webhooks/twilio-voice/process?callSid=call-phone-lookup',
        { Digits: '1', To: '+19084184377' },
      ),
    );

    expect(response.status).toBe(200);
    expect(mockFindBusinessByPhone).toHaveBeenCalledWith({
      where: {
        vapiPhoneNumber: '9084184377',
      },
      select: expect.any(Object),
    });
  });
});
