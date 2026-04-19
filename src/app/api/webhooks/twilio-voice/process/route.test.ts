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
  getConfiguredAppBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));

vi.mock('@/lib/openai', () => ({
  generateVoiceResponse: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { generateVoiceResponse } from '@/lib/openai';
import { POST } from './route';

const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockGenerateVoiceResponse = generateVoiceResponse as ReturnType<typeof vi.fn>;

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
  name: 'Test Salon',
  businessType: 'Salon',
  phone: '+15551234567',
  street: '123 Main St',
  city: 'Howell',
  state: 'NJ',
  publicId: 'AB-123456',
  aiReceptionistEnabled: true,
  aiReceptionistSpanishEnabled: true,
  aiReceptionistPhone: '+15557654321',
  aiReceptionistFaq: [{ question: 'Do you take walk-ins?', answer: 'Yes, if availability opens up.' }],
  services: [{ name: 'Gel Manicure', price: 45, duration: 45, description: 'Classic gel manicure.' }],
  businessHours: { hours: { 1: { isOpen: true, openTime: '09:00', closeTime: '17:00' } } },
};

describe('POST /api/webhooks/twilio-voice/process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindBusiness.mockResolvedValue(business);
  });

  it('acknowledges a spanish digit choice and switches the gather language', async () => {
    const response = await POST(
      buildRequest(
        'https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&callSid=call-es-choice',
        { Digits: '2' },
      ),
    );

    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('Perfecto, seguire en espanol. En que puedo ayudarle hoy?');
    expect(xml).toContain('voice="Polly.Lupe"');
    expect(xml).toContain('language="es-US"');
    expect(mockGenerateVoiceResponse).not.toHaveBeenCalled();
  });

  it('continues in spanish when the first utterance is clearly spanish', async () => {
    mockGenerateVoiceResponse.mockResolvedValue('Claro, tenemos citas manana por la tarde.');

    const response = await POST(
      buildRequest(
        'https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&callSid=call-es-inferred',
        { SpeechResult: 'Hola, necesito una cita manana por la tarde' },
      ),
    );

    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(mockGenerateVoiceResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: 'Hola, necesito una cita manana por la tarde',
        systemPrompt: expect.stringContaining('The caller has already selected Spanish'),
      }),
    );
    expect(xml).toContain('Claro, tenemos citas manana por la tarde.');
    expect(xml).toContain('voice="Polly.Lupe"');
    expect(xml).toContain('language="es-US"');
  });

  it('uses the spanish transfer phrase when the caller asks for a person in spanish', async () => {
    const response = await POST(
      buildRequest(
        'https://www.clientific.app/api/webhooks/twilio-voice/process?publicId=AB-123456&callSid=call-es-transfer&lang=es',
        { SpeechResult: 'Quiero hablar con una persona real' },
      ),
    );

    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain('Claro, le conecto ahora. Un momento por favor.');
    expect(xml).toContain('<Dial>+15557654321</Dial>');
    expect(mockGenerateVoiceResponse).not.toHaveBeenCalled();
  });
});
