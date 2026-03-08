import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';

// ── Vapi helpers ──────────────────────────────────────────────────────────────

function parseAreaCode(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1, 4);
  if (digits.length === 10) return digits.slice(0, 3);
  return null;
}

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

// ── GET ───────────────────────────────────────────────────────────────────────

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

// ── PATCH ─────────────────────────────────────────────────────────────────────

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
      notifyNewBookingEmail,
      pointsPerDollar,
      pointsPerVisit,
    } = body;

    // Fetch current business to detect Vapi state changes
    const current = await prisma.business.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        phone: true,
        aiReceptionistEnabled: true,
        vapiPhoneNumberId: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Determine final enabled state
    const finalEnabled = aiReceptionistEnabled !== undefined
      ? aiReceptionistEnabled
      : current.aiReceptionistEnabled;

    // Vapi operations — only run if VAPI_PRIVATE_KEY is configured
    const vapiUpdates: Record<string, string | null> = {};
    const vapiConfigured = !!process.env.VAPI_PRIVATE_KEY;
    const appUrl = getConfiguredAppBaseUrl();
    const serverUrl = `${appUrl}/api/webhooks/vapi`;

    if (vapiConfigured && finalEnabled && !current.vapiPhoneNumberId) {
      // Toggling ON — provision phone number with server.url (Vapi's current API structure)
      const areaCode = parseAreaCode(phone ?? current.phone) ?? '800';
      const phoneNumber = await vapiRequest('POST', '/phone-number', {
        provider: 'vapi',
        numberDesiredAreaCode: areaCode,
        name: `${name ?? current.name} Receptionist`,
        server: { url: serverUrl },
      });
      // Also PATCH to ensure server.url is set (belt-and-suspenders)
      const patchResult = await vapiRequest('PATCH', `/phone-number/${phoneNumber.id}`, {
        server: { url: serverUrl },
      });
      console.log('[vapi] provisioned phone number, server.url confirmed:', patchResult?.server?.url);
      vapiUpdates.vapiPhoneNumberId = phoneNumber.id;
      vapiUpdates.vapiPhoneNumber = phoneNumber.number;
    } else if (vapiConfigured && !finalEnabled && current.vapiPhoneNumberId) {
      // Toggling OFF — release phone number
      await vapiRequest('DELETE', `/phone-number/${current.vapiPhoneNumberId}`);
      vapiUpdates.vapiPhoneNumberId = null;
      vapiUpdates.vapiPhoneNumber = null;
    } else if (vapiConfigured && finalEnabled && current.vapiPhoneNumberId) {
      // Already enabled — sync server.url on every save
      const syncResult = await vapiRequest('PATCH', `/phone-number/${current.vapiPhoneNumberId}`, {
        server: { url: serverUrl },
      }).catch((e: any) => { console.error('[vapi] Failed to sync phone number server URL:', e); return null; });
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
        ...(notifyNewBookingEmail !== undefined && { notifyNewBookingEmail }),
        ...(pointsPerDollar !== undefined && { pointsPerDollar: Number(pointsPerDollar) }),
        ...(pointsPerVisit !== undefined && { pointsPerVisit: Math.round(Number(pointsPerVisit)) }),
        ...('vapiPhoneNumberId' in vapiUpdates && { vapiPhoneNumberId: vapiUpdates.vapiPhoneNumberId }),
        ...('vapiPhoneNumber' in vapiUpdates && { vapiPhoneNumber: vapiUpdates.vapiPhoneNumber }),
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
