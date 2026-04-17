import { addDays } from 'date-fns';
import { prisma } from '@/lib/prisma';
import {
  createEmailVerificationCode,
  isValidEmail,
  normalizeEmail,
  packVerificationHash,
} from '@/lib/auth-verification';
import { sendEmailVerificationEmail } from '@/lib/email';
import { generateReferralCode } from '@/lib/referral';
import { STANDARD_TRIAL_DAYS } from '@/lib/referral-config';
import {
  getReferralSharingStatus,
  resolveReferralSharingStatus,
} from '@/lib/referral-sharing';
import { normalizeOptionalStoredPhoneNumber } from '@/lib/phone';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeSubscriptionPlan } from '@/lib/plan-utils';
import {
  generatePublicBusinessId,
  generateSlug,
  hashPassword,
} from '@/lib/utils';

type RegisterBusinessMode = 'web' | 'mobile';

export type RegisterBusinessInput = {
  email?: string;
  password?: string;
  businessName?: string;
  businessType?: string;
  phone?: string;
  businessEmail?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  timezone?: string;
  plan?: string;
  referralCode?: string;
};

export class RegisterBusinessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'RegisterBusinessError';
  }
}

async function createDefaultBusinessHours(businessId: string) {
  const defaultHoursJson: Record<
    string,
    { isOpen: boolean; openTime: string | null; closeTime: string | null }
  > = {};

  for (let day = 0; day <= 6; day++) {
    const isWeekend = day === 0 || day === 6;
    defaultHoursJson[day.toString()] = {
      isOpen: !isWeekend,
      openTime: isWeekend ? null : '09:00',
      closeTime: isWeekend ? null : '17:00',
    };
  }

  try {
    await prisma.businessHours.create({
      data: {
        businessId,
        hours: defaultHoursJson,
      },
    });
  } catch (error) {
    console.error('Failed to create default business hours:', error);
  }
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function registerBusinessAccount(args: {
  input: RegisterBusinessInput;
  mode: RegisterBusinessMode;
}) {
  const { input, mode } = args;
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
  } = input;

  if (!email || !password || !businessName || !businessType) {
    throw new RegisterBusinessError('Missing required fields', 400);
  }

  const normalizedEmail = typeof email === 'string' ? normalizeEmail(email) : '';
  const normalizedBusinessName = normalizeString(businessName);
  const normalizedPhone =
    typeof phone === 'string' && phone.trim().length > 0
      ? normalizeOptionalStoredPhoneNumber(phone) ?? ''
      : '';
  const normalizedBusinessType = normalizeString(businessType);
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
    throw new RegisterBusinessError('Invalid email', 400);
  }

  if (!normalizedBusinessName || normalizedBusinessName.length > 100) {
    throw new RegisterBusinessError('Business name must be 1-100 characters', 400);
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new RegisterBusinessError('Password must be 8-128 characters', 400);
  }

  if (!normalizedBusinessType) {
    throw new RegisterBusinessError('Business type is required', 400);
  }

  if (!/[0-9]/.test(password)) {
    throw new RegisterBusinessError('Password must include at least one number', 400);
  }

  if (!/[!@#$%^&*]/.test(password)) {
    throw new RegisterBusinessError(
      'Password must include at least one special character (!@#$%^&*)',
      400,
    );
  }

  const blockedField = getBlockedFieldLabel([
    { label: 'Business name', value: normalizedBusinessName },
    { label: 'Street', value: normalizedStreet },
    { label: 'City', value: normalizedCity },
  ]);

  if (blockedField) {
    throw new RegisterBusinessError(blockedContentError(blockedField), 400);
  }

  const existingBusiness = await prisma.business.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingBusiness) {
    throw new RegisterBusinessError('An account with this email already exists', 400);
  }

  let slug = generateSlug(normalizedBusinessName);
  let slugExists = await prisma.business.findUnique({ where: { slug } });
  let counter = 1;

  while (slugExists) {
    slug = `${generateSlug(normalizedBusinessName)}-${counter}`;
    slugExists = await prisma.business.findUnique({ where: { slug } });
    counter += 1;
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
        error,
      );

      if (!getReferralSharingStatus(referrerCandidate).ready) {
        referrerBusiness = null;
      }
    }
  }

  const normalizedPlan =
    mode === 'web' ? normalizeSubscriptionPlan(plan ?? 'starter') : 'trial';
  const trialEndsAt = mode === 'web' ? addDays(new Date(), STANDARD_TRIAL_DAYS) : null;

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
      subscriptionStatus: mode === 'web' ? 'trialing' : 'inactive',
      billingProvider: mode === 'web' ? 'stripe' : 'none',
      trialEndsAt,
      subscriptionCurrentPeriodEnd: null,
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

  await createDefaultBusinessHours(business.id);

  let verificationEmailSent = false;
  try {
    await sendEmailVerificationEmail(business.email, verificationCode);
    verificationEmailSent = true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
  }

  return {
    success: true as const,
    requiresEmailVerification: true,
    verificationEmailSent,
    business: {
      id: business.id,
      email: business.email,
      name: business.name,
      slug: business.slug,
    },
  };
}
