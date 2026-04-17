import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateSlug, generatePublicBusinessId } from '@/lib/utils';
import { generateReferralCode } from '@/lib/referral';
import { STANDARD_TRIAL_DAYS } from '@/lib/referral-config';
import { addDays } from 'date-fns';
import {
  createEmailVerificationCode,
  isValidEmail,
  normalizeEmail,
  packVerificationHash,
} from '@/lib/auth-verification';
import { sendEmailVerificationEmail } from '@/lib/email';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeSubscriptionPlan } from '@/lib/plan-utils';
import {
  getReferralSharingStatus,
  resolveReferralSharingStatus,
} from '@/lib/referral-sharing';
import { normalizeOptionalStoredPhoneNumber } from '@/lib/phone';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      email,
      password,
      businessName,
      businessType,
      phone,
      businessEmail,
      street,
      city,
      state,
      zipCode,
      country,
      timezone,
      plan,
      referralCode,
    } = body;

    if (!email || !password || !businessName || !businessType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = typeof email === 'string' ? normalizeEmail(email) : '';
    const normalizedBusinessName =
      typeof businessName === 'string' ? businessName.trim() : '';
    const normalizedPhone =
      typeof phone === 'string' && phone.trim().length > 0
        ? normalizeOptionalStoredPhoneNumber(phone) ?? ''
        : '';
    const normalizedBusinessType =
      typeof businessType === 'string' ? businessType.trim() : '';
    const normalizedBusinessEmail =
      typeof businessEmail === 'string' && businessEmail.trim().length > 0
        ? businessEmail.trim()
        : null;
    const normalizedStreet =
      typeof street === 'string' && street.trim().length > 0 ? street.trim() : null;
    const normalizedCity =
      typeof city === 'string' && city.trim().length > 0 ? city.trim() : null;
    const normalizedState =
      typeof state === 'string' && state.trim().length > 0 ? state.trim() : null;
    const normalizedZipCode =
      typeof zipCode === 'string' && zipCode.trim().length > 0 ? zipCode.trim() : null;
    const normalizedCountry =
      typeof country === 'string' && country.trim().length > 0 ? country.trim() : null;

    if (!normalizedEmail || normalizedEmail.length > 254 || !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    if (!normalizedBusinessName || normalizedBusinessName.length > 100) {
      return NextResponse.json(
        { error: 'Business name must be 1-100 characters' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be 8-128 characters' },
        { status: 400 }
      );
    }

    if (!normalizedBusinessType) {
      return NextResponse.json({ error: 'Business type is required' }, { status: 400 });
    }

    if (!/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must include at least one number' },
        { status: 400 }
      );
    }

    if (!/[!@#$%^&*]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must include at least one special character (!@#$%^&*)' },
        { status: 400 }
      );
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Business name', value: normalizedBusinessName },
      { label: 'Street', value: normalizedStreet },
      { label: 'City', value: normalizedCity },
    ]);

    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const existingBusiness = await prisma.business.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingBusiness) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    let slug = generateSlug(normalizedBusinessName);
    let slugExists = await prisma.business.findUnique({ where: { slug } });
    let counter = 1;

    while (slugExists) {
      slug = `${generateSlug(normalizedBusinessName)}-${counter}`;
      slugExists = await prisma.business.findUnique({ where: { slug } });
      counter++;
    }

    let publicId = generatePublicBusinessId();
    let publicIdExists = await prisma.business.findUnique({ where: { publicId } });

    while (publicIdExists) {
      publicId = generatePublicBusinessId();
      publicIdExists = await prisma.business.findUnique({ where: { publicId } });
    }

    const passwordHash = await hashPassword(password);

    const referrerCandidate = referralCode
      ? await prisma.business.findUnique({ where: { referralCode } })
      : null;

    let referrerBusiness = referrerCandidate;
    if (referrerCandidate) {
      try {
        const sharingStatus = await resolveReferralSharingStatus({
          id: referrerCandidate.id,
          stripeConnectAccountId: referrerCandidate.stripeConnectAccountId,
          stripeConnectChargesEnabled: referrerCandidate.stripeConnectChargesEnabled,
          stripeConnectPayoutsEnabled: referrerCandidate.stripeConnectPayoutsEnabled,
          stripeConnectDetailsSubmitted: referrerCandidate.stripeConnectDetailsSubmitted,
        });

        if (!sharingStatus.ready) {
          referrerBusiness = null;
        }
      } catch (error) {
        console.warn(
          'Registration could not refresh referral payout readiness, falling back to cached status:',
          error
        );

        if (!getReferralSharingStatus(referrerCandidate).ready) {
          referrerBusiness = null;
        }
      }
    }

    const normalizedPlan = normalizeSubscriptionPlan(plan ?? 'starter');
    const trialDays = STANDARD_TRIAL_DAYS;
    const trialEndsAt = addDays(new Date(), trialDays);

    const newReferralCode = await generateReferralCode();
    const { token: verificationCode, tokenHash, expiresAt: verificationExpiry } =
      createEmailVerificationCode();

    const business = await prisma.business.create({
      data: {
        email: normalizedEmail,
        emailVerificationTokenHash: packVerificationHash(tokenHash, 0),
        emailVerificationTokenExpiry: verificationExpiry,
        verificationSentAt: new Date(),
        passwordHash,
        name: normalizedBusinessName,
        slug,
        publicId,
        businessType: normalizedBusinessType,
        phone: normalizedPhone,
        businessEmail: normalizedBusinessEmail,
        street: normalizedStreet,
        city: normalizedCity,
        state: normalizedState,
        zipCode: normalizedZipCode,
        country: normalizedCountry,
        timezone: timezone || 'America/New_York',
        subscriptionPlan: normalizedPlan,
        subscriptionStatus: 'trialing',
        billingProvider: 'stripe',
        trialEndsAt,
        referralCode: newReferralCode,
        ...(referrerBusiness && { referredById: referrerBusiness.id }),
      },
    });

    if (referrerBusiness) {
      await prisma.referral.create({
        data: {
          referrerId: referrerBusiness.id,
          refereeId: business.id,
        },
      });
    }

    try {
      const defaultHoursJson: Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }> = {};

      for (let day = 0; day <= 6; day++) {
        const isWeekend = day === 0 || day === 6;
        defaultHoursJson[day.toString()] = {
          isOpen: !isWeekend,
          openTime: isWeekend ? null : '09:00',
          closeTime: isWeekend ? null : '17:00',
        };
      }

      await prisma.businessHours.create({
        data: {
          businessId: business.id,
          hours: defaultHoursJson,
        },
      });
    } catch (hoursError) {
      console.error('Failed to create default business hours:', hoursError);
    }

    let verificationEmailSent = false;
    try {
      await sendEmailVerificationEmail(business.email, verificationCode);
      verificationEmailSent = true;
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    return NextResponse.json({
      success: true,
      requiresEmailVerification: true,
      verificationEmailSent,
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        slug: business.slug,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);

    let errorMessage = 'Unable to create account. Please try again later.';
    let statusCode = 500;

    if (
      error.message?.includes("Can't reach database") ||
      error.code === 'P1001' ||
      error.code === 'ECONNREFUSED'
    ) {
      errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
    } else if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      errorMessage = 'An account with this email already exists.';
      statusCode = 400;
    } else if (error.code === 'P2011' || error.message?.includes('required')) {
      errorMessage = 'Please provide all required information.';
      statusCode = 400;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
