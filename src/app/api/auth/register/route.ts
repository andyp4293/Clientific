import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateSlug } from '@/lib/utils';
import { addDays } from 'date-fns';

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
    } = body;

    // Validate required fields
    if (!email || !password || !businessName || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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
    }

    // Generate unique slug
    let slug = generateSlug(businessName);
    let slugExists = await prisma.business.findUnique({ where: { slug } });
    let counter = 1;
    
    while (slugExists) {
      slug = `${generateSlug(businessName)}-${counter}`;
      slugExists = await prisma.business.findUnique({ where: { slug } });
      counter++;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Calculate trial end date (14 days from now)
    const trialEndsAt = addDays(new Date(), 14);

    // Create business account
    const business = await prisma.business.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: businessName,
        slug,
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
      },
    });

    // Create default business hours (Monday-Friday 9-5, closed weekends)
    const defaultHours = [];
    for (let day = 0; day <= 6; day++) {
      const isWeekend = day === 0 || day === 6;
      defaultHours.push({
        businessId: business.id,
        dayOfWeek: day,
        isOpen: !isWeekend,
        openTime: isWeekend ? null : '09:00',
        closeTime: isWeekend ? null : '17:00',
      });
    }

    await prisma.businessHours.createMany({
      data: defaultHours,
    });

    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        slug: business.slug,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
