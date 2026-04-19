import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredWebhookBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));

import { prisma } from '@/lib/prisma';
import { POST } from './route';

const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;

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
  });

  it('serves the standard english gather when spanish is disabled', async () => {
    mockFindBusiness.mockResolvedValue({
      name: 'Test Salon',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'Howell',
      state: 'NJ',
      timezone: 'America/New_York',
      publicId: 'AB-123456',
      aiReceptionistEnabled: true,
      aiReceptionistSpanishEnabled: false,
      aiReceptionistPhone: '+15557654321',
      aiReceptionistGreeting: null,
    });

    const response = await POST(buildRequest({ CallSid: 'call-1' }));
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('Hi, thank you for calling Test Salon. How can I help you today?');
    expect(xml).toContain('input="speech"');
    expect(xml).toContain('language="en-US"');
    expect(xml).not.toContain('Para espanol');
  });

  it('adds a bilingual selector before the fallback english gather when spanish is enabled', async () => {
    mockFindBusiness.mockResolvedValue({
      name: 'Test Salon',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'Howell',
      state: 'NJ',
      timezone: 'America/New_York',
      publicId: 'AB-123456',
      aiReceptionistEnabled: true,
      aiReceptionistSpanishEnabled: true,
      aiReceptionistPhone: '+15557654321',
      aiReceptionistGreeting: null,
    });

    const response = await POST(buildRequest({ CallSid: 'call-2' }));
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('Hi, this is Test Salon.');
    expect(xml).toContain('For English, say English. Or press 1.');
    expect(xml).toContain('Hola, habla Test Salon.');
    expect(xml).toContain('Para espanol, diga espanol. Oprima 2.');
    expect(xml).toContain('input="speech dtmf"');
    expect(xml).toContain('numDigits="1"');
    expect(xml).toContain('hints="English, Ingles, Spanish, Espanol"');
    expect(xml).toContain("I'll keep us in English. How can I help you today?");
    expect(xml).toContain('action="https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&callSid=call-2&lang=en"');
  });
});
