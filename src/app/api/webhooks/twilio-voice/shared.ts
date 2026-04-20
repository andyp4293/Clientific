import { prisma } from '@/lib/prisma';
import { normalizeOptionalStoredPhoneNumber } from '@/lib/phone';
import type { AiReceptionistCallLanguage } from '@/lib/ai-receptionist-language';
import {
  AI_ENABLED_BUSINESS_SELECT,
  buildAssistantConfig,
} from '@/app/api/webhooks/vapi/route';

const TWILIO_VOICE_BUSINESS_SELECT = {
  ...AI_ENABLED_BUSINESS_SELECT,
  aiReceptionistEnabled: true,
} as const;

export type TwilioVoiceBusiness = NonNullable<
  Awaited<ReturnType<typeof findAiReceptionistBusiness>>
>;

export async function findAiReceptionistBusiness(params: {
  publicId?: string | null;
  toNumber?: string | null;
}) {
  const publicId = params.publicId?.trim();
  if (publicId) {
    return prisma.business.findUnique({
      where: { publicId },
      select: TWILIO_VOICE_BUSINESS_SELECT,
    });
  }

  const normalizedToNumber = normalizeOptionalStoredPhoneNumber(params.toNumber);
  if (!normalizedToNumber) {
    return null;
  }

  return prisma.business.findFirst({
    where: {
      vapiPhoneNumber: normalizedToNumber,
    },
    select: TWILIO_VOICE_BUSINESS_SELECT,
  });
}

export async function initiateVapiBypassCall(params: {
  business: TwilioVoiceBusiness;
  callerNumber: string | null;
  forcedLanguage: AiReceptionistCallLanguage;
}) {
  const { business, callerNumber, forcedLanguage } = params;

  const apiKey = process.env.VAPI_PRIVATE_KEY?.trim();
  if (!apiKey || !business.vapiPhoneNumberId) {
    console.error('[twilio-voice] Missing Vapi credentials or phone number id', {
      hasApiKey: Boolean(apiKey),
      phoneNumberId: business.vapiPhoneNumberId,
      businessId: business.id,
    });
    return null;
  }

  const assistant = buildAssistantConfig(business, { forcedLanguage });

  const res = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumberId: business.vapiPhoneNumberId,
      phoneCallProviderBypassEnabled: true,
      ...(callerNumber ? { customer: { number: callerNumber } } : {}),
      assistant,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[twilio-voice] Failed to create bypass Vapi call', {
      status: res.status,
      body,
      businessId: business.id,
      forcedLanguage,
    });
    return null;
  }

  const data = await res.json();
  const twiml = data?.phoneCallProviderDetails?.twiml;
  if (typeof twiml !== 'string' || twiml.trim().length === 0) {
    console.error('[twilio-voice] Vapi bypass call returned no TwiML', {
      businessId: business.id,
      forcedLanguage,
    });
    return null;
  }

  return twiml;
}
