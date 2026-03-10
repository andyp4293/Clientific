import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

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
      pointsPerDollar,
      pointsPerVisit,
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

    if (publicProfileHeadline !== undefined && typeof publicProfileHeadline !== 'string') {
      return NextResponse.json({ error: 'Public profile headline must be text' }, { status: 400 });
    }
    if (publicProfileAbout !== undefined && typeof publicProfileAbout !== 'string') {
      return NextResponse.json({ error: 'Public profile about must be text' }, { status: 400 });
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
      const phoneNumber = await vapiRequest('POST', '/phone-number', {
        provider: 'vapi',
        name: `${name ?? current.name} Receptionist`,
        server: { url: serverUrl },
      });

      if (!phoneNumber?.id) {
        throw new Error('AI receptionist number provisioning failed');
      }

      const patchResult = await vapiRequest('PATCH', `/phone-number/${phoneNumber.id}`, {
        server: { url: serverUrl },
      });

      console.log('[vapi] provisioned number, server.url confirmed:', patchResult?.server?.url);

      vapiUpdates.vapiPhoneNumberId = phoneNumber.id;
      vapiUpdates.vapiPhoneNumber = phoneNumber.number ?? null;
      vapiUpdates.smsAiPhoneNumber = phoneNumber.number ?? null;
      vapiUpdates.smsAiEnabled = Boolean(phoneNumber.number);
    } else if (vapiConfigured && !finalEnabled && current.vapiPhoneNumberId) {
      await vapiRequest('DELETE', `/phone-number/${current.vapiPhoneNumberId}`);

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
      if (current.vapiPhoneNumber) {
        vapiUpdates.smsAiPhoneNumber = current.vapiPhoneNumber;
        vapiUpdates.smsAiEnabled = true;
      }
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
      { error: 'Failed to update business settings. Please try again.' },
      { status: 500 }
    );
  }
}

