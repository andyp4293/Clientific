import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import twilio from 'twilio';

async function vapiRequest(method: string, path: string, body?: object) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
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

type TwilioProvisionedNumber = {
  sid: string;
  phoneNumber: string;
};

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are required for AI receptionist number provisioning');
  }

  return twilio(accountSid, authToken);
}

async function provisionTwilioTollFreeNumber(): Promise<TwilioProvisionedNumber> {
  const client = getTwilioClient();
  const available = await client.availablePhoneNumbers('US').tollFree.list({
    smsEnabled: true,
    voiceEnabled: true,
    limit: 1,
  });

  const candidate = available[0]?.phoneNumber;
  if (!candidate) {
    throw new Error('No toll-free numbers are currently available from Twilio');
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

async function setTwilioSmsWebhook(numberSid: string, appUrl: string): Promise<void> {
  const client = getTwilioClient();
  await client.incomingPhoneNumbers(numberSid).update({
    smsUrl: `${appUrl}/api/webhooks/twilio-sms`,
    smsMethod: 'POST',
  });
}

async function releaseTwilioNumberBySid(numberSid: string): Promise<void> {
  const client = getTwilioClient();
  await client.incomingPhoneNumbers(numberSid).remove();
}

async function releaseTwilioNumberByPhone(phoneNumber: string | null | undefined): Promise<void> {
  if (!phoneNumber) return;

  const client = getTwilioClient();
  const matches = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  const sid = matches[0]?.sid;

  if (!sid) return;
  await client.incomingPhoneNumbers(sid).remove();
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
        phone: true,
        businessEmail: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        timezone: true,
        logoUrl: true,
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
        pointsPerDollar: true,
        pointsPerVisit: true,
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
      phone,
      businessEmail,
      street,
      city,
      state,
      zipCode,
      country,
      timezone,
      logoUrl,
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
      pointsPerDollar,
      pointsPerVisit,
    } = body;

    const blockedField = getBlockedFieldLabel([
      { label: 'Business name', value: name },
      { label: 'Street', value: street },
      { label: 'City', value: city },
      { label: 'AI greeting', value: aiReceptionistGreeting },
      { label: 'AI FAQ', value: typeof aiReceptionistFaq === 'string' ? aiReceptionistFaq : null },
      { label: 'SMS AI greeting', value: smsAiGreeting },
    ]);

    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
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

    const finalEnabled = aiReceptionistEnabled !== undefined
      ? aiReceptionistEnabled
      : current.aiReceptionistEnabled;

    const vapiUpdates: {
      vapiPhoneNumberId?: string | null;
      vapiPhoneNumber?: string | null;
      smsAiPhoneNumber?: string | null;
      smsAiEnabled?: boolean;
    } = {};

    const vapiConfigured = !!process.env.VAPI_PRIVATE_KEY;
    const appUrl = getConfiguredAppBaseUrl();
    const serverUrl = `${appUrl}/api/webhooks/vapi`;

    if (vapiConfigured && finalEnabled && !current.vapiPhoneNumberId) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials are required to provision an AI receptionist number');
      }

      let twilioNumber: TwilioProvisionedNumber | null = null;

      try {
        twilioNumber = await provisionTwilioTollFreeNumber();

        const phoneNumber = await vapiRequest('POST', '/phone-number', {
          provider: 'twilio',
          number: twilioNumber.phoneNumber,
          twilioAccountSid: accountSid,
          twilioAuthToken: authToken,
          smsEnabled: false,
          name: `${name ?? current.name} Receptionist`,
          server: { url: serverUrl },
        });

        const patchResult = await vapiRequest('PATCH', `/phone-number/${phoneNumber.id}`, {
          server: { url: serverUrl },
        });

        console.log('[vapi] provisioned Twilio number, server.url confirmed:', patchResult?.server?.url);

        await setTwilioSmsWebhook(twilioNumber.sid, appUrl);

        vapiUpdates.vapiPhoneNumberId = phoneNumber.id;
        vapiUpdates.vapiPhoneNumber = phoneNumber.number ?? twilioNumber.phoneNumber;

        if (smsAiPhoneNumber === undefined && !current.smsAiPhoneNumber) {
          vapiUpdates.smsAiPhoneNumber = twilioNumber.phoneNumber;
        }
      } catch (error) {
        if (twilioNumber?.sid) {
          await releaseTwilioNumberBySid(twilioNumber.sid).catch((releaseError) => {
            console.error('[twilio] rollback failed after Vapi provisioning error:', releaseError);
          });
        }
        throw error;
      }
    } else if (vapiConfigured && !finalEnabled && current.vapiPhoneNumberId) {
      await vapiRequest('DELETE', `/phone-number/${current.vapiPhoneNumberId}`);
      await releaseTwilioNumberByPhone(current.vapiPhoneNumber).catch((releaseError) => {
        console.error('[twilio] failed to release number on AI disable:', releaseError);
      });

      vapiUpdates.vapiPhoneNumberId = null;
      vapiUpdates.vapiPhoneNumber = null;

      if (
        smsAiPhoneNumber === undefined &&
        current.smsAiPhoneNumber &&
        current.smsAiPhoneNumber === current.vapiPhoneNumber
      ) {
        vapiUpdates.smsAiPhoneNumber = null;
        if (smsAiEnabled === undefined && current.smsAiEnabled) {
          vapiUpdates.smsAiEnabled = false;
        }
      }
    } else if (vapiConfigured && finalEnabled && current.vapiPhoneNumberId) {
      const syncResult = await vapiRequest('PATCH', `/phone-number/${current.vapiPhoneNumberId}`, {
        server: { url: serverUrl },
      }).catch((e: any) => {
        console.error('[vapi] Failed to sync phone number server URL:', e);
        return null;
      });

      console.log('[vapi] synced phone number server.url:', syncResult?.server?.url ?? 'error');
    }

    const business = await prisma.business.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(businessType && { businessType }),
        ...(phone && { phone }),
        ...(businessEmail !== undefined && { businessEmail }),
        ...(street !== undefined && { street }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zipCode !== undefined && { zipCode }),
        ...(country !== undefined && { country }),
        ...(timezone && { timezone }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(enableOnlineBooking !== undefined && { enableOnlineBooking }),
        ...(googleReviewUrl !== undefined && { googleReviewUrl }),
        ...(facebookPageUrl !== undefined && { facebookPageUrl }),
        ...(yelpUrl !== undefined && { yelpUrl }),
        ...(instagramUrl !== undefined && { instagramUrl }),
        ...(aiReceptionistEnabled !== undefined && { aiReceptionistEnabled }),
        ...(aiReceptionistPhone !== undefined && { aiReceptionistPhone }),
        ...(aiReceptionistGreeting !== undefined && { aiReceptionistGreeting }),
        ...(aiReceptionistFaq !== undefined && { aiReceptionistFaq }),
        ...(smsAiEnabled !== undefined && { smsAiEnabled }),
        ...(smsAiPhoneNumber !== undefined && { smsAiPhoneNumber }),
        ...(smsAiGreeting !== undefined && { smsAiGreeting }),
        ...(notifyNewBookingEmail !== undefined && { notifyNewBookingEmail }),
        ...(pointsPerDollar !== undefined && { pointsPerDollar: Number(pointsPerDollar) }),
        ...(pointsPerVisit !== undefined && { pointsPerVisit: Math.round(Number(pointsPerVisit)) }),
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
      { error: error.message || 'Failed to update business' },
      { status: 500 }
    );
  }
}

