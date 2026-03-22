import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeOptionalPhoneNumber } from '@/lib/twilio';
import twilio from 'twilio';

type TwilioProvisionedNumber = {
  sid: string;
  phoneNumber: string;
};

const VAPI_TWILIO_INBOUND_CALL_URL = 'https://api.vapi.ai/twilio/inbound_call';
const VAPI_TWILIO_STATUS_CALLBACK_URL = 'https://api.vapi.ai/twilio/status';

function getTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  );
}

function getPublicTwilioSmsWebhookUrl(appUrl: string): string | null {
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== 'https:' || isLocalHostname(parsed.hostname)) {
      return null;
    }
    return `${parsed.origin}/api/webhooks/twilio-sms`;
  } catch {
    return null;
  }
}

function isTwilioInvalidSmsUrlError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as Record<string, unknown>).code;
  return String(maybeCode ?? '') === '21402';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseAreaCode(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return null;
}

function hasTwilioCredentials(): boolean {
  return !!getTrimmedEnv('TWILIO_ACCOUNT_SID') && !!getTrimmedEnv('TWILIO_AUTH_TOKEN');
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
    console.warn(
      '[twilio] Skipping sms webhook configuration because app URL is not publicly reachable:',
      appUrl
    );
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
      console.warn(
        '[twilio] Skipping sms webhook configuration because Twilio rejected the SMS URL:',
        smsWebhookUrl
      );
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
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Vapi ${method} ${path} failed: ${res.status} ${text}`);
  }

  return res.status === 204 || res.status === 404 ? null : res.json();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        slug: true,
        publicId: true,
        email: true,
        businessType: true,
        ownerPhone: true,
        phone: true,
        businessEmail: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        timezone: true,
        logoUrl: true,
        publicProfileHeadline: true,
        publicProfileAbout: true,
        publicProfileShowPhone: true,
        publicProfileShowEmail: true,
        publicProfileShowAddress: true,
        publicProfileShowHours: true,
        publicProfileShowServices: true,
        publicProfileShowTeam: true,
        publicProfileShowSocialLinks: true,
        enableOnlineBooking: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        googleReviewUrl: true,
        facebookPageUrl: true,
        yelpUrl: true,
        instagramUrl: true,
        aiReceptionistEnabled: true,
        aiReceptionistPhone: true,
        aiReceptionistGreeting: true,
        aiReceptionistFaq: true,
        smsAiEnabled: true,
        smsAiPhoneNumber: true,
        smsAiGreeting: true,
        vapiPhoneNumber: true,
        notifyNewBookingEmail: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error: any) {
    console.error('Fetch business error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch business' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const body = await req.json();
    const {
      name,
      businessType,
      ownerPhone,
      phone,
      businessEmail,
      street,
      city,
      state,
      zipCode,
      country,
      timezone,
      logoUrl,
      publicProfileHeadline,
      publicProfileAbout,
      publicProfileShowPhone,
      publicProfileShowEmail,
      publicProfileShowAddress,
      publicProfileShowHours,
      publicProfileShowServices,
      publicProfileShowTeam,
      publicProfileShowSocialLinks,
      enableOnlineBooking,
      googleReviewUrl,
      facebookPageUrl,
      yelpUrl,
      instagramUrl,
      aiReceptionistEnabled,
      aiReceptionistPhone,
      aiReceptionistGreeting,
      aiReceptionistFaq,
      smsAiEnabled,
      smsAiPhoneNumber,
      smsAiGreeting,
      notifyNewBookingEmail,
    } = body;

    const blockedField = getBlockedFieldLabel([
      { label: 'Business name', value: name },
      { label: 'Street', value: street },
      { label: 'City', value: city },
      { label: 'Public profile headline', value: publicProfileHeadline },
      { label: 'Public profile about', value: publicProfileAbout },
      { label: 'AI greeting', value: aiReceptionistGreeting },
      { label: 'AI FAQ', value: typeof aiReceptionistFaq === 'string' ? aiReceptionistFaq : null },
      { label: 'SMS AI greeting', value: smsAiGreeting },
    ]);

    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (publicProfileHeadline !== undefined && !isNullableString(publicProfileHeadline)) {
      return NextResponse.json({ error: 'Public profile headline must be text' }, { status: 400 });
    }
    if (publicProfileAbout !== undefined && !isNullableString(publicProfileAbout)) {
      return NextResponse.json({ error: 'Public profile about must be text' }, { status: 400 });
    }
    if (aiReceptionistPhone !== undefined && !isNullableString(aiReceptionistPhone)) {
      return NextResponse.json({ error: 'Transfer-to phone number must be text' }, { status: 400 });
    }
    if (ownerPhone !== undefined && !isNullableString(ownerPhone)) {
      return NextResponse.json({ error: 'Personal phone must be text' }, { status: 400 });
    }
    if (typeof publicProfileHeadline === 'string' && publicProfileHeadline.trim().length > 90) {
      return NextResponse.json({ error: 'Public profile headline must be 90 characters or less' }, { status: 400 });
    }
    if (typeof publicProfileAbout === 'string' && publicProfileAbout.trim().length > 1200) {
      return NextResponse.json({ error: 'Public profile about must be 1200 characters or less' }, { status: 400 });
    }

    const boolFields: Array<[string, unknown]> = [
      ['publicProfileShowPhone', publicProfileShowPhone],
      ['publicProfileShowEmail', publicProfileShowEmail],
      ['publicProfileShowAddress', publicProfileShowAddress],
      ['publicProfileShowHours', publicProfileShowHours],
      ['publicProfileShowServices', publicProfileShowServices],
      ['publicProfileShowTeam', publicProfileShowTeam],
      ['publicProfileShowSocialLinks', publicProfileShowSocialLinks],
    ];
    for (const [field, value] of boolFields) {
      if (value !== undefined && typeof value !== 'boolean') {
        return NextResponse.json({ error: `${field} must be true or false` }, { status: 400 });
      }
    }

    const current = await prisma.business.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        phone: true,
        aiReceptionistEnabled: true,
        vapiPhoneNumberId: true,
        vapiPhoneNumber: true,
        smsAiEnabled: true,
        smsAiPhoneNumber: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const normalizedAiReceptionistPhone =
      aiReceptionistPhone === undefined
        ? undefined
        : normalizeOptionalPhoneNumber(aiReceptionistPhone);
    const normalizedOwnerPhone =
      ownerPhone === undefined
        ? undefined
        : normalizeOptionalPhoneNumber(ownerPhone);

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
        { status: 400 }
      );
    }

    if (
      typeof ownerPhone === 'string' &&
      ownerPhone.trim().length > 0 &&
      !normalizedOwnerPhone
    ) {
      return NextResponse.json(
        {
          error:
            'Personal phone must be a valid phone number with country code or 10-digit US format',
        },
        { status: 400 }
      );
    }

    const finalEnabled = aiReceptionistEnabled !== undefined
      ? aiReceptionistEnabled
      : current.aiReceptionistEnabled;

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
      fallbackId?: string
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

    // Vapi numbers can be returned as activating before the final number is attached.
    // Poll a few times so we don't treat this eventual-consistency window as a hard failure.
    const waitForVapiNumber = async (
      phoneNumberId: string,
      attempts = 4,
      delayMs = 1200
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
      delayMs = 800
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
        const preferredAreaCode = parseAreaCode(phone ?? current.phone);
        twilioNumber = await provisionTwilioPhoneNumber(preferredAreaCode);

        const phoneNumber = await vapiRequest('POST', '/phone-number', {
          provider: 'twilio',
          number: twilioNumber.phoneNumber,
          twilioAccountSid,
          twilioAuthToken,
          smsEnabled: false,
          name: `${name ?? current.name} Receptionist`,
          server: { url: serverUrl },
        });

        const initialState = toVapiNumberState(phoneNumber);
        if (!initialState?.id) {
          throw new Error('AI receptionist number provisioning failed');
        }
        createdVapiPhoneNumberId = initialState.id;

        const patchResult = await vapiRequest('PATCH', `/phone-number/${initialState.id}`, {
          server: { url: serverUrl },
        }).catch((e: any) => {
          console.error('[vapi] Failed to sync freshly provisioned number server URL:', e);
          return null;
        });

        const patchState = toVapiNumberState(patchResult, initialState.id);
        const syncedState: VapiNumberState = {
          id: initialState.id,
          number: patchState?.number ?? initialState.number,
          status: patchState?.status ?? initialState.status,
        };
        console.log('[vapi] provisioned number, server.url confirmed:', patchResult?.server?.url ?? 'error');

        let readyState = syncedState;
        if (!readyState.number) {
          readyState = (await waitForVapiNumber(initialState.id).catch((e: any) => {
            console.error('[vapi] Failed to poll provisioned phone number details:', e);
            return syncedState;
          })) ?? syncedState;
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
          await vapiRequest('DELETE', `/phone-number/${createdVapiPhoneNumberId}`).catch((cleanupError) => {
            console.error('[vapi] rollback failed after provisioning error:', cleanupError);
          });
        }
        if (twilioNumber?.sid) {
          await releaseTwilioNumberBySid(twilioNumber.sid).catch((releaseError) => {
            console.error('[twilio] rollback failed after provisioning error:', releaseError);
          });
        }
        throw error;
      }
    };

    const vapiConfigured = !!process.env.VAPI_PRIVATE_KEY;
    const appUrl = getConfiguredAppBaseUrl();
    const serverUrl = `${appUrl}/api/webhooks/vapi`;

    if (vapiConfigured && finalEnabled && !current.vapiPhoneNumberId) {
      const provisioned = await provisionVapiNumber();

      vapiUpdates.vapiPhoneNumberId = provisioned.phoneNumberId;
      if (provisioned.phoneNumber) {
        vapiUpdates.vapiPhoneNumber = provisioned.phoneNumber;
        vapiUpdates.smsAiPhoneNumber = provisioned.phoneNumber;
        vapiUpdates.smsAiEnabled = true;
      } else {
        // Leave receptionist enabled and allow UI to show "pending setup" until number is assigned.
        vapiUpdates.vapiPhoneNumber = null;
        vapiUpdates.smsAiPhoneNumber = null;
        vapiUpdates.smsAiEnabled = false;
        console.warn('[vapi] Number is still activating after provisioning; setup remains pending');
      }
    } else if (vapiConfigured && !finalEnabled && current.vapiPhoneNumberId) {
      await vapiRequest('DELETE', `/phone-number/${current.vapiPhoneNumberId}`);
      const deleted = await waitForVapiDeletion(current.vapiPhoneNumberId).catch((e: any) => {
        console.error('[vapi] Failed to verify phone number deletion:', e);
        return false;
      });
      if (!deleted) {
        throw new Error('AI receptionist number deletion did not complete');
      }
      await releaseTwilioNumberByPhone(current.vapiPhoneNumber).catch((e: any) => {
        console.error('[twilio] Failed to release toll-free number on disable:', e);
        throw e;
      });

      vapiUpdates.vapiPhoneNumberId = null;
      vapiUpdates.vapiPhoneNumber = null;
      vapiUpdates.smsAiPhoneNumber = null;
      vapiUpdates.smsAiEnabled = false;
    } else if (vapiConfigured && finalEnabled && current.vapiPhoneNumberId) {
      const syncResult = await vapiRequest('PATCH', `/phone-number/${current.vapiPhoneNumberId}`, {
        server: { url: serverUrl },
      }).catch((e: any) => {
        console.error('[vapi] Failed to sync phone number server URL:', e);
        return null;
      });

      console.log('[vapi] synced phone number server.url:', syncResult?.server?.url ?? 'error');
      const syncState = toVapiNumberState(syncResult, current.vapiPhoneNumberId);
      let knownState: VapiNumberState | null = syncState;
      let resolvedPhoneNumber =
        syncState?.number ?? normalizePhoneNumber(current.vapiPhoneNumber);
      if (!resolvedPhoneNumber) {
        knownState = await waitForVapiNumber(current.vapiPhoneNumberId).catch((e: any) => {
          console.error('[vapi] Failed to fetch phone number details:', e);
          return null;
        });
        resolvedPhoneNumber = knownState?.number ?? null;
      }
      if (!resolvedPhoneNumber && knownState?.status === 'blocked') {
        throw new Error('AI receptionist number is blocked in Vapi');
      }
      if (!resolvedPhoneNumber && !knownState) {
        console.warn('[vapi] Existing phone number was missing; provisioning replacement number');
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
          console.warn('[vapi] Replacement number is still activating; setup remains pending');
        }
      } else if (!resolvedPhoneNumber) {
        vapiUpdates.vapiPhoneNumber = null;
        vapiUpdates.smsAiPhoneNumber = null;
        vapiUpdates.smsAiEnabled = false;
        console.warn('[vapi] Existing number is still activating; setup remains pending');
      } else {
        if (hasTwilioCredentials()) {
          await syncTwilioIncomingNumberWebhooksByPhone(resolvedPhoneNumber, appUrl);
        } else {
          console.warn(
            '[twilio] Skipping AI receptionist routing sync because Twilio credentials are not configured'
          );
        }
        vapiUpdates.vapiPhoneNumber = resolvedPhoneNumber;
        vapiUpdates.smsAiPhoneNumber = resolvedPhoneNumber;
        vapiUpdates.smsAiEnabled = true;
      }
    }

    const business = await prisma.business.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(businessType && { businessType }),
        ...(normalizedOwnerPhone !== undefined && { ownerPhone: normalizedOwnerPhone }),
        ...(phone && { phone }),
        ...(businessEmail !== undefined && { businessEmail }),
        ...(street !== undefined && { street }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zipCode !== undefined && { zipCode }),
        ...(country !== undefined && { country }),
        ...(timezone && { timezone }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(publicProfileHeadline !== undefined && { publicProfileHeadline: publicProfileHeadline?.trim() || null }),
        ...(publicProfileAbout !== undefined && { publicProfileAbout: publicProfileAbout?.trim() || null }),
        ...(publicProfileShowPhone !== undefined && { publicProfileShowPhone }),
        ...(publicProfileShowEmail !== undefined && { publicProfileShowEmail }),
        ...(publicProfileShowAddress !== undefined && { publicProfileShowAddress }),
        ...(publicProfileShowHours !== undefined && { publicProfileShowHours }),
        ...(publicProfileShowServices !== undefined && { publicProfileShowServices }),
        ...(publicProfileShowTeam !== undefined && { publicProfileShowTeam }),
        ...(publicProfileShowSocialLinks !== undefined && { publicProfileShowSocialLinks }),
        ...(enableOnlineBooking !== undefined && { enableOnlineBooking }),
        ...(googleReviewUrl !== undefined && { googleReviewUrl }),
        ...(facebookPageUrl !== undefined && { facebookPageUrl }),
        ...(yelpUrl !== undefined && { yelpUrl }),
        ...(instagramUrl !== undefined && { instagramUrl }),
        ...(aiReceptionistEnabled !== undefined && { aiReceptionistEnabled }),
        ...(normalizedAiReceptionistPhone !== undefined && {
          aiReceptionistPhone: normalizedAiReceptionistPhone,
        }),
        ...(aiReceptionistGreeting !== undefined && { aiReceptionistGreeting }),
        ...(aiReceptionistFaq !== undefined && { aiReceptionistFaq }),
        ...(smsAiEnabled !== undefined && { smsAiEnabled }),
        ...(smsAiPhoneNumber !== undefined && { smsAiPhoneNumber }),
        ...(smsAiGreeting !== undefined && { smsAiGreeting }),
        ...(notifyNewBookingEmail !== undefined && { notifyNewBookingEmail }),
        ...('vapiPhoneNumberId' in vapiUpdates && { vapiPhoneNumberId: vapiUpdates.vapiPhoneNumberId }),
        ...('vapiPhoneNumber' in vapiUpdates && { vapiPhoneNumber: vapiUpdates.vapiPhoneNumber }),
        ...('smsAiPhoneNumber' in vapiUpdates && { smsAiPhoneNumber: vapiUpdates.smsAiPhoneNumber }),
        ...('smsAiEnabled' in vapiUpdates && { smsAiEnabled: vapiUpdates.smsAiEnabled }),
      },
    });

    return NextResponse.json({ business });
  } catch (error: any) {
    console.error('Update business error:', error);
    return NextResponse.json(
      { error: 'Failed to update business settings. Please try again.' },
      { status: 500 }
    );
  }
}

