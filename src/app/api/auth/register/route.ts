import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateSlug, generatePublicBusinessId } from '@/lib/utils';
import { generateReferralCode } from '@/lib/referral';
import { addDays } from 'date-fns';
import { createEmailVerificationToken, isValidEmail } from '@/lib/auth-verification';
import { sendEmailVerificationEmail } from '@/lib/email';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

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
      affiliateCode,
    } = body;

    // Validate required fields
    if (!email || !password || !businessName || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Input length guards
    if (typeof email !== 'string' || email.length > 254 || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (typeof businessName !== 'string' || businessName.trim().length === 0 || businessName.length > 100) {
      return NextResponse.json({ error: 'Business name must be 1–100 characters' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'Password must be 8–128 characters' },
        { status: 400 }
      );
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Business name', value: businessName },
      { label: 'Street', value: street },
      { label: 'City', value: city },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    // Check if email already exists
    const existingBusiness = await prisma.business.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingBusiness) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }    // Generate unique slug
    let slug = generateSlug(businessName);
    let slugExists = await prisma.business.findUnique({ where: { slug } });
    let counter = 1;
    
    while (slugExists) {
      slug = `${generateSlug(businessName)}-${counter}`;
      slugExists = await prisma.business.findUnique({ where: { slug } });
      counter++;
    }

    // Generate unique public business ID
    let publicId = generatePublicBusinessId();
    let publicIdExists = await prisma.business.findUnique({ where: { publicId } });
    
    while (publicIdExists) {
      publicId = generatePublicBusinessId();
      publicIdExists = await prisma.business.findUnique({ where: { publicId } });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Look up referrer (if a referral code was provided)
    const referrerBusiness = referralCode
      ? await prisma.business.findUnique({ where: { referralCode } })
      : null;

    // Look up affiliate (if an affiliate code was provided and no referral code took priority)
    const affiliate = !referrerBusiness && affiliateCode
      ? await prisma.affiliate.findUnique({ where: { code: affiliateCode, active: true } })
      : null;

    // Referred or affiliate-referred businesses get 30 extra trial days (44 total)
    const trialDays = referrerBusiness || affiliate ? 44 : 14;
    const trialEndsAt = addDays(new Date(), trialDays);

    // Generate this new business's own unique referral code
    const newReferralCode = await generateReferralCode();
    const { token: verificationToken, tokenHash, expiresAt: verificationExpiry } =
      createEmailVerificationToken();

    // Create business account
    const business = await prisma.business.create({
      data: {
        email: email.toLowerCase(),
        emailVerificationTokenHash: tokenHash,
        emailVerificationTokenExpiry: verificationExpiry,
        verificationSentAt: new Date(),
        passwordHash,
        name: businessName,
        slug,
        publicId,
        businessType,
        phone,
        businessEmail: businessEmail || email.toLowerCase(),
        street,
        city,
        state,
        zipCode,
        country,
        timezone: timezone || 'America/New_York',
        subscriptionPlan: plan || 'trial',
        subscriptionStatus: 'trialing',
        trialEndsAt,
        referralCode: newReferralCode,
        ...(referrerBusiness && { referredById: referrerBusiness.id }),
        ...(affiliate && { affiliateCodeUsed: affiliate.code }),
      },
    });

    // Create the referral record so we can credit the referrer later
    if (referrerBusiness) {
      await prisma.referral.create({
        data: {
          referrerId: referrerBusiness.id,
          refereeId: business.id,
        },
      });
    }

    // Create the affiliate signup record so we can track the payout later
    if (affiliate) {
      await prisma.affiliateSignup.create({
        data: {
          affiliateId: affiliate.id,
          businessId: business.id,
        },
      });
    }

    // Create default business hours (Monday-Friday 9-5, closed weekends)
    try {
      const defaultHoursJson: any = {};
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
      // Continue anyway - hours can be set up later
    }
    let verificationEmailSent = false;
    try {
      await sendEmailVerificationEmail(business.email, verificationToken);
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
    
    // Handle specific error cases with user-friendly messages
    let errorMessage = 'Unable to create account. Please try again later.';
    let statusCode = 500;
    
    // Database connection errors
    if (error.message?.includes('Can\'t reach database') || 
        error.code === 'P1001' || 
        error.code === 'ECONNREFUSED') {
      errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
    }
    // Duplicate email (unique constraint)
    else if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      errorMessage = 'An account with this email already exists.';
      statusCode = 400;
    }
    // Missing required fields
    else if (error.code === 'P2011' || error.message?.includes('required')) {
      errorMessage = 'Please provide all required information.';
      statusCode = 400;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
