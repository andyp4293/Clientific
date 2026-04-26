import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeOptionalStoredPhoneNumber } from '@/lib/phone';

const BUSINESS_SELECT = {
  id: true,
  email: true,
  name: true,
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
} as const;

type MobileBusinessRecord = {
  id: string;
  email: string;
  name: string;
  businessType: string | null;
  ownerPhone: string | null;
  phone: string | null;
  businessEmail: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  timezone: string | null;
};

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Mobile sign-in is required.' }, { status: 401 });
}

async function getAuthorizedBusiness(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: unauthorizedResponse() } as const;
  }

  try {
    const session = await verifyMobileSessionToken(token);
    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: BUSINESS_SELECT,
    });

    if (!business) {
      return { error: unauthorizedResponse() } as const;
    }

    return { business } as const;
  } catch {
    return { error: unauthorizedResponse() } as const;
  }
}

function formatBusinessResponse(business: MobileBusinessRecord) {
  return {
    ...business,
    onboardingComplete: isBusinessOnboardingComplete(business),
  };
}

export async function GET(request: Request) {
  const authorized = await getAuthorizedBusiness(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  return NextResponse.json({
    business: formatBusinessResponse(authorized.business),
  });
}

export async function PATCH(request: Request) {
  const authorized = await getAuthorizedBusiness(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const ownerPhoneInput =
    typeof body.ownerPhone === 'string' && body.ownerPhone.trim().length > 0
      ? normalizeOptionalStoredPhoneNumber(body.ownerPhone) ?? null
      : null;
  const businessPhoneInput =
    typeof body.phone === 'string' && body.phone.trim().length > 0
      ? normalizeOptionalStoredPhoneNumber(body.phone) ?? null
      : null;
  const businessEmailInput =
    typeof body.businessEmail === 'string' && body.businessEmail.trim().length > 0
      ? body.businessEmail.trim()
      : null;
  const street = typeof body.street === 'string' ? body.street.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const state = typeof body.state === 'string' ? body.state.trim() : '';
  const zipCode = typeof body.zipCode === 'string' ? body.zipCode.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim() : '';
  const timezone =
    typeof body.timezone === 'string' && body.timezone.trim().length > 0
      ? body.timezone.trim()
      : authorized.business.timezone || 'America/New_York';

  if (!businessPhoneInput) {
    return NextResponse.json({ error: 'Enter a valid business phone number.' }, { status: 400 });
  }

  if (!street || !city || !state || !zipCode || !country) {
    return NextResponse.json(
      { error: 'Enter your business address to finish setup.' },
      { status: 400 },
    );
  }

  const blockedField = getBlockedFieldLabel([
    { label: 'Street', value: street },
    { label: 'City', value: city },
  ]);

  if (blockedField) {
    return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
  }

  const updatedBusiness = await prisma.business.update({
    where: { id: authorized.business.id },
    data: {
      ownerPhone: ownerPhoneInput,
      phone: businessPhoneInput,
      businessEmail: businessEmailInput,
      street,
      city,
      state,
      zipCode,
      country,
      timezone,
    },
    select: BUSINESS_SELECT,
  });

  return NextResponse.json({
    business: formatBusinessResponse(updatedBusiness),
  });
}

export async function DELETE(request: Request) {
  const authorized = await getAuthorizedBusiness(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    await prisma.business.delete({
      where: { id: authorized.business.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mobile/business error:', error);
    return NextResponse.json(
      { error: 'Unable to delete your account right now.' },
      { status: 500 },
    );
  }
}
