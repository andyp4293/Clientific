import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeOptionalStoredPhoneNumber } from '@/lib/phone';
import { canAccessAiReceptionist } from '@/lib/plan-access';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import {
  ensureSharedPlatformSmsWebhookConfigured,
  getPublicTwilioSmsWebhookUrl,
  hasTwilioCredentials,
} from '@/lib/twilio-routing';

type TwilioProvisionedNumber = {
  sid: string;
  phoneNumber: string;
};

const VAPI_TWILIO_INBOUND_CALL_URL = 'https://api.vapi.ai/twilio/inbound_call';
const VAPI_TWILIO_STATUS_CALLBACK_URL = 'https://api.vapi.ai/twilio/status';

const AI_RECEPTIONIST_SELECT = {
  id: true,
  email: true,
  name: true,
  businessType: true,
  phone: true,
  street: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  subscriptionPlan: true,
  aiReceptionistEnabled: true,
  aiReceptionistPhone: true,
  aiReceptionistGreeting: true,
  aiReceptionistFaq: true,
  smsAiEnabled: true,
  smsAiPhoneNumber: true,
  smsAiGreeting: true,
  vapiPhoneNumberId: true,
  vapiPhoneNumber: true,
} as const;

type AiReceptionistBusiness = {
  id: string;
  email: string;
  name: string;
  businessType: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  subscriptionPlan: string | null;
  aiReceptionistEnabled: boolean;
  aiReceptionistPhone: string | null;
  aiReceptionistGreeting: string | null;
  aiReceptionistFaq: unknown;
  smsAiEnabled: boolean;
  smsAiPhoneNumber: string | null;
  smsAiGreeting: string | null;
  vapiPhoneNumberId: string | null;
  vapiPhoneNumber: string | null;
};

function getTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isTwilioInvalidSmsUrlError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as Record<string, unknown>).code;
  return String(maybeCode ?? '') === '21402';
}

function parseAreaCode(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return null;
}

function getTwilioClient() {
  const accountSid = getTrimmedEnv('TWILIO_ACCOUNT_SID');
  const authToken = getTrimmedEnv('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are required for AI receptionist number provisioning');
  }

  return twilio(accountSid, authToken);
}

async function provisionTwilioPhoneNumber(preferredAreaCode?: string | null): Promise<TwilioProvisionedNumber> {
  const client = getTwilioClient();
  const areaCode = preferredAreaCode && /^\d{3}$/.test(preferredAreaCode)
    ? Number(preferredAreaCode)
    : null;

  let candidate: string | undefined;
  if (areaCode) {
    const local = await client.availablePhoneNumbers('US').local.list({
      areaCode,
      smsEnabled: true,
      voiceEnabled: true,
      limit: 1,
    });
    candidate = local[0]?.phoneNumber;
  }

  if (!candidate) {
    const tollFree = await client.availablePhoneNumbers('US').tollFree.list({
      smsEnabled: true,
      voiceEnabled: true,
      limit: 1,
    });
    candidate = tollFree[0]?.phoneNumber;
  }

  if (!candidate) {
    throw new Error('No compatible Twilio phone numbers are currently available');
  }

  const purchased = await client.incomingPhoneNumbers.create({ phoneNumber: candidate });

  if (!purchased.sid || !purchased.phoneNumber) {
    throw new Error('Twilio returned an invalid purchased number payload');
  }

  return {
    sid: purchased.sid,
    phoneNumber: purchased.phoneNumber,
  };
}

async function syncTwilioIncomingNumberWebhooks(numberSid: string, appUrl: string): Promise<void> {
  const client = getTwilioClient();
  const baseRouting = {
    voiceUrl: VAPI_TWILIO_INBOUND_CALL_URL,
    voiceMethod: 'POST',
    statusCallback: VAPI_TWILIO_STATUS_CALLBACK_URL,
    statusCallbackMethod: 'POST',
  } as const;

  const smsWebhookUrl = getPublicTwilioSmsWebhookUrl(appUrl);
  if (!smsWebhookUrl) {
    await client.incomingPhoneNumbers(numberSid).update(baseRouting);
    return;
  }

  try {
    await client.incomingPhoneNumbers(numberSid).update({
      ...baseRouting,
      smsUrl: smsWebhookUrl,
      smsMethod: 'POST',
    });
  } catch (error: any) {
    if (isTwilioInvalidSmsUrlError(error)) {
      await client.incomingPhoneNumbers(numberSid).update(baseRouting);
      return;
    }
    throw error;
  }
}

async function releaseTwilioNumberBySid(numberSid: string): Promise<void> {
  const client = getTwilioClient();
  await client.incomingPhoneNumbers(numberSid).remove();
}

async function findTwilioNumberByPhone(
  phoneNumber: string | null | undefined
): Promise<TwilioProvisionedNumber | null> {
  if (!phoneNumber) return null;
  const client = getTwilioClient();
  const matches = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  const match = matches[0];
  if (!match?.sid) {
    return null;
  }
  return {
    sid: match.sid,
    phoneNumber: match.phoneNumber ?? phoneNumber,
  };
}

async function releaseTwilioNumberByPhone(phoneNumber: string | null | undefined): Promise<void> {
  const match = await findTwilioNumberByPhone(phoneNumber);
  if (!match?.sid) return;
  await releaseTwilioNumberBySid(match.sid);
}

async function syncTwilioIncomingNumberWebhooksByPhone(
  phoneNumber: string | null | undefined,
  appUrl: string
): Promise<void> {
  const match = await findTwilioNumberByPhone(phoneNumber);
  if (!match?.sid) {
    throw new Error('Twilio could not find the AI receptionist number to repair call routing');
  }
  await syncTwilioIncomingNumberWebhooks(match.sid, appUrl);
}

async function vapiRequest(method: string, path: string, body?: object) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getTrimmedEnv('VAPI_PRIVATE_KEY') ?? ''}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Vapi ${method} ${path} failed: ${res.status} ${text}`);
  }

  return res.status === 204 || res.status === 404 ? null : res.json();
}

function sanitizeFaq(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ question: string; answer: string }>;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const question =
        typeof (item as { question?: unknown }).question === 'string'
          ? (item as { question: string }).question.trim()
          : '';
      const answer =
        typeof (item as { answer?: unknown }).answer === 'string'
          ? (item as { answer: string }).answer.trim()
          : '';

      if (!question && !answer) {
        return null;
      }

      return { question, answer };
    })
    .filter((item): item is { question: string; answer: string } => Boolean(item));
}

function formatResponse(business: AiReceptionistBusiness) {
  const faq = sanitizeFaq(business.aiReceptionistFaq);
  const unifiedNumber = (business.vapiPhoneNumber || business.smsAiPhoneNumber || '').trim() || null;

  return {
    business: {
      id: business.id,
      email: business.email,
      name: business.name,
      businessType: business.businessType,
      onboardingComplete: isBusinessOnboardingComplete(business),
    },
    subscriptionPlan: business.subscriptionPlan,
    hasAccess: canAccessAiReceptionist(business.subscriptionPlan),
    aiReceptionistEnabled: business.aiReceptionistEnabled,
    aiReceptionistPhone: business.aiReceptionistPhone,
    aiReceptionistGreeting: business.aiReceptionistGreeting,
    aiReceptionistFaq: faq,
    smsAiEnabled: business.smsAiEnabled,
    smsAiPhoneNumber: business.smsAiPhoneNumber,
    smsAiGreeting: business.smsAiGreeting,
    vapiPhoneNumber: business.vapiPhoneNumber,
    unifiedNumber,
  };
}

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: authorized.session.businessId },
      select: AI_RECEPTIONIST_SELECT,
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureSharedPlatformSmsWebhookConfigured(getConfiguredAppBaseUrl()).catch((error) => {
      console.error('[twilio] Failed to verify shared platform SMS webhook during mobile AI receptionist fetch:', error);
    });

    return NextResponse.json(formatResponse(business));
  } catch (error) {
    console.error('GET /api/mobile/ai-receptionist error:', error);
    return NextResponse.json({ error: 'Unable to load AI receptionist' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
  if (subscriptionError) {
    return subscriptionError;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    aiReceptionistEnabled,
    aiReceptionistPhone,
    aiReceptionistGreeting,
    aiReceptionistFaq,
    smsAiGreeting,
  } = body;

  try {
    const current = await prisma.business.findUnique({
      where: { id: authorized.session.businessId },
      select: AI_RECEPTIONIST_SELECT,
    });

    if (!current) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!canAccessAiReceptionist(current.subscriptionPlan)) {
      return NextResponse.json(
        {
          error: 'AI receptionist is available on Pro and Premium plans.',
          code: 'PLAN_UPGRADE_REQUIRED',
        },
        { status: 403 },
      );
    }

    const sanitizedFaq = aiReceptionistFaq === undefined ? undefined : sanitizeFaq(aiReceptionistFaq);
    const blockedField = getBlockedFieldLabel([
      { label: 'AI greeting', value: typeof aiReceptionistGreeting === 'string' ? aiReceptionistGreeting : null },
      {
        label: 'AI FAQ',
        value: sanitizedFaq?.map((item) => `${item.question} ${item.answer}`).join(' ') ?? null,
      },
      { label: 'SMS AI greeting', value: typeof smsAiGreeting === 'string' ? smsAiGreeting : null },
    ]);

    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (aiReceptionistEnabled !== undefined && typeof aiReceptionistEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Enable state must be true or false' }, { status: 400 });
    }

    const isNullableString = (value: unknown): value is string | null =>
      value === null || typeof value === 'string';

    if (aiReceptionistPhone !== undefined && !isNullableString(aiReceptionistPhone)) {
      return NextResponse.json({ error: 'Transfer-to phone number must be text' }, { status: 400 });
    }
    if (aiReceptionistGreeting !== undefined && !isNullableString(aiReceptionistGreeting)) {
      return NextResponse.json({ error: 'Greeting must be text' }, { status: 400 });
    }
    if (smsAiGreeting !== undefined && !isNullableString(smsAiGreeting)) {
      return NextResponse.json({ error: 'SMS greeting must be text' }, { status: 400 });
    }

    const normalizedAiReceptionistPhone =
      aiReceptionistPhone === undefined
        ? undefined
        : normalizeOptionalStoredPhoneNumber(aiReceptionistPhone);

    if (
      typeof aiReceptionistPhone === 'string' &&
      aiReceptionistPhone.trim().length > 0 &&
      !normalizedAiReceptionistPhone
    ) {
      return NextResponse.json(
        {
          error:
            'Transfer-to phone number must be a valid phone number with country code or 10-digit US format',
        },
        { status: 400 },
      );
    }

    const currentVapiForwardingLoopCandidate =
      current.vapiPhoneNumber && normalizeOptionalStoredPhoneNumber(current.vapiPhoneNumber);

    if (
      normalizedAiReceptionistPhone &&
      currentVapiForwardingLoopCandidate &&
      normalizedAiReceptionistPhone === currentVapiForwardingLoopCandidate
    ) {
      return NextResponse.json(
        {
          error:
            'Transfer-to phone number cannot be the AI receptionist number itself. Use a real person phone number.',
        },
        { status: 400 },
      );
    }

    const finalEnabled =
      aiReceptionistEnabled !== undefined ? aiReceptionistEnabled : current.aiReceptionistEnabled;

    const vapiUpdates: {
      vapiPhoneNumberId?: string | null;
      vapiPhoneNumber?: string | null;
      smsAiPhoneNumber?: string | null;
      smsAiEnabled?: boolean;
    } = {};

    const normalizePhoneNumber = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const normalizeVapiStatus = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim().toLowerCase();
      return trimmed.length > 0 ? trimmed : null;
    };

    type VapiNumberState = {
      id: string;
      number: string | null;
      status: string | null;
    };

    const toVapiNumberState = (
      value: unknown,
      fallbackId?: string,
    ): VapiNumberState | null => {
      if (!value || typeof value !== 'object') return null;
      const parsed = value as Record<string, unknown>;
      const id =
        (typeof parsed.id === 'string' && parsed.id.trim()) ||
        (fallbackId?.trim() || null);
      if (!id) return null;

      return {
        id,
        number: normalizePhoneNumber(parsed.number),
        status: normalizeVapiStatus(parsed.status),
      };
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForVapiNumber = async (
      phoneNumberId: string,
      attempts = 4,
      delayMs = 1200,
    ): Promise<VapiNumberState | null> => {
      let latest: VapiNumberState | null = null;
      for (let i = 0; i < attempts; i++) {
        const details = await vapiRequest('GET', `/phone-number/${phoneNumberId}`);
        if (!details) {
          return null;
        }
        latest = toVapiNumberState(details, phoneNumberId);
        if (latest?.number || latest?.status === 'blocked') {
          return latest;
        }
        if (i < attempts - 1) {
          await sleep(delayMs);
        }
      }
      return latest;
    };

    const waitForVapiDeletion = async (
      phoneNumberId: string,
      attempts = 4,
      delayMs = 800,
    ): Promise<boolean> => {
      for (let i = 0; i < attempts; i++) {
        const details = await vapiRequest('GET', `/phone-number/${phoneNumberId}`);
        if (!details) return true;
        if (i < attempts - 1) {
          await sleep(delayMs);
        }
      }
      return false;
    };

    const appUrl = getConfiguredAppBaseUrl();
    const serverUrl = `${appUrl}/api/webhooks/vapi`;
    const vapiConfigured = !!process.env.VAPI_PRIVATE_KEY;

    const provisionVapiNumber = async (): Promise<{
      phoneNumberId: string;
      phoneNumber: string | null;
      status: string | null;
    }> => {
      const twilioAccountSid = getTrimmedEnv('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = getTrimmedEnv('TWILIO_AUTH_TOKEN');
      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error('Twilio credentials are required to provision an AI receptionist number');
      }

      let twilioNumber: TwilioProvisionedNumber | null = null;
      let createdVapiPhoneNumberId: string | null = null;
      try {
        const preferredAreaCode = parseAreaCode(current.phone);
        twilioNumber = await provisionTwilioPhoneNumber(preferredAreaCode);

        const phoneNumber = await vapiRequest('POST', '/phone-number', {
          provider: 'twilio',
          number: twilioNumber.phoneNumber,
          twilioAccountSid,
          twilioAuthToken,
          smsEnabled: false,
          name: `${current.name} Receptionist`,
          server: { url: serverUrl },
        });

        const initialState = toVapiNumberState(phoneNumber);
        if (!initialState?.id) {
          throw new Error('AI receptionist number provisioning failed');
        }
        createdVapiPhoneNumberId = initialState.id;

        const patchResult = await vapiRequest('PATCH', `/phone-number/${initialState.id}`, {
          server: { url: serverUrl },
        }).catch(() => null);

        const patchState = toVapiNumberState(patchResult, initialState.id);
        const syncedState: VapiNumberState = {
          id: initialState.id,
          number: patchState?.number ?? initialState.number,
          status: patchState?.status ?? initialState.status,
        };

        let readyState = syncedState;
        if (!readyState.number) {
          readyState = (await waitForVapiNumber(initialState.id).catch(() => syncedState)) ?? syncedState;
        }

        if (readyState?.status === 'blocked') {
          throw new Error('AI receptionist number provisioning failed: number is blocked in Vapi');
        }

        await syncTwilioIncomingNumberWebhooks(twilioNumber.sid, appUrl);

        return {
          phoneNumberId: initialState.id,
          phoneNumber: readyState?.number ?? twilioNumber.phoneNumber,
          status: readyState?.status ?? syncedState.status ?? null,
        };
      } catch (error) {
        if (createdVapiPhoneNumberId) {
          await vapiRequest('DELETE', `/phone-number/${createdVapiPhoneNumberId}`).catch(() => null);
        }
        if (twilioNumber?.sid) {
          await releaseTwilioNumberBySid(twilioNumber.sid).catch(() => null);
        }
        throw error;
      }
    };

    if (vapiConfigured && finalEnabled && !current.vapiPhoneNumberId) {
      const provisioned = await provisionVapiNumber();
      vapiUpdates.vapiPhoneNumberId = provisioned.phoneNumberId;
      if (provisioned.phoneNumber) {
        vapiUpdates.vapiPhoneNumber = provisioned.phoneNumber;
        vapiUpdates.smsAiPhoneNumber = provisioned.phoneNumber;
        vapiUpdates.smsAiEnabled = true;
      } else {
        vapiUpdates.vapiPhoneNumber = null;
        vapiUpdates.smsAiPhoneNumber = null;
        vapiUpdates.smsAiEnabled = false;
      }
    } else if (vapiConfigured && !finalEnabled && current.vapiPhoneNumberId) {
      await vapiRequest('DELETE', `/phone-number/${current.vapiPhoneNumberId}`);
      const deleted = await waitForVapiDeletion(current.vapiPhoneNumberId).catch(() => false);
      if (!deleted) {
        throw new Error('AI receptionist number deletion did not complete');
      }
      await releaseTwilioNumberByPhone(current.vapiPhoneNumber);
      vapiUpdates.vapiPhoneNumberId = null;
      vapiUpdates.vapiPhoneNumber = null;
      vapiUpdates.smsAiPhoneNumber = null;
      vapiUpdates.smsAiEnabled = false;
    } else if (vapiConfigured && finalEnabled && current.vapiPhoneNumberId) {
      const syncResult = await vapiRequest('PATCH', `/phone-number/${current.vapiPhoneNumberId}`, {
        server: { url: serverUrl },
      }).catch(() => null);

      const syncState = toVapiNumberState(syncResult, current.vapiPhoneNumberId);
      let knownState: VapiNumberState | null = syncState;
      let resolvedPhoneNumber = syncState?.number ?? normalizePhoneNumber(current.vapiPhoneNumber);

      if (!resolvedPhoneNumber) {
        knownState = await waitForVapiNumber(current.vapiPhoneNumberId).catch(() => null);
        resolvedPhoneNumber = knownState?.number ?? null;
      }

      if (!resolvedPhoneNumber && knownState?.status === 'blocked') {
        throw new Error('AI receptionist number is blocked in Vapi');
      }

      if (!resolvedPhoneNumber && !knownState) {
        const replacement = await provisionVapiNumber();
        vapiUpdates.vapiPhoneNumberId = replacement.phoneNumberId;
        if (replacement.phoneNumber) {
          vapiUpdates.vapiPhoneNumber = replacement.phoneNumber;
          vapiUpdates.smsAiPhoneNumber = replacement.phoneNumber;
          vapiUpdates.smsAiEnabled = true;
        } else {
          vapiUpdates.vapiPhoneNumber = null;
          vapiUpdates.smsAiPhoneNumber = null;
          vapiUpdates.smsAiEnabled = false;
        }
      } else if (!resolvedPhoneNumber) {
        vapiUpdates.vapiPhoneNumber = null;
        vapiUpdates.smsAiPhoneNumber = null;
        vapiUpdates.smsAiEnabled = false;
      } else {
        if (hasTwilioCredentials()) {
          await syncTwilioIncomingNumberWebhooksByPhone(resolvedPhoneNumber, appUrl);
        }
        vapiUpdates.vapiPhoneNumber = resolvedPhoneNumber;
        vapiUpdates.smsAiPhoneNumber = resolvedPhoneNumber;
        vapiUpdates.smsAiEnabled = true;
      }
    }

    const updated = await prisma.business.update({
      where: { id: authorized.session.businessId },
      data: {
        ...(aiReceptionistEnabled !== undefined ? { aiReceptionistEnabled } : {}),
        ...(normalizedAiReceptionistPhone !== undefined
          ? { aiReceptionistPhone: normalizedAiReceptionistPhone }
          : {}),
        ...(aiReceptionistGreeting !== undefined ? { aiReceptionistGreeting } : {}),
        ...(sanitizedFaq !== undefined ? { aiReceptionistFaq: sanitizedFaq } : {}),
        ...(smsAiGreeting !== undefined ? { smsAiGreeting } : {}),
        ...('vapiPhoneNumberId' in vapiUpdates ? { vapiPhoneNumberId: vapiUpdates.vapiPhoneNumberId } : {}),
        ...('vapiPhoneNumber' in vapiUpdates ? { vapiPhoneNumber: vapiUpdates.vapiPhoneNumber } : {}),
        ...('smsAiPhoneNumber' in vapiUpdates ? { smsAiPhoneNumber: vapiUpdates.smsAiPhoneNumber } : {}),
        ...('smsAiEnabled' in vapiUpdates ? { smsAiEnabled: vapiUpdates.smsAiEnabled } : {}),
      },
      select: AI_RECEPTIONIST_SELECT,
    });

    await ensureSharedPlatformSmsWebhookConfigured(appUrl).catch((error) => {
      console.error('[twilio] Failed to verify shared platform SMS webhook during mobile AI receptionist update:', error);
    });

    return NextResponse.json(formatResponse(updated));
  } catch (error) {
    console.error('PATCH /api/mobile/ai-receptionist error:', error);
    return NextResponse.json(
      { error: 'Failed to update AI receptionist settings. Please try again.' },
      { status: 500 },
    );
  }
}
