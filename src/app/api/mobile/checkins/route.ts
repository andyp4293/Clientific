import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CheckInFlowError, createBusinessCheckIn } from '@/lib/checkins';
import { businessDayStart } from '@/lib/timezone';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { formatPhoneForDisplay } from '@/lib/phone';
import { requireActiveSubscription } from '@/lib/subscription';

function formatLocalDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('/', '-');
}

function formatDateLabel(dateKey: string, timezone: string) {
  const start = businessDayStart(dateKey, timezone);
  return start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
}

function formatTimeLabel(isoString: string, timezone: string) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function formatLastVisit(isoString: string | null | undefined, timezone: string) {
  if (!isoString) {
    return null;
  }

  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
}

function formatCurrency(amount: number | null | undefined) {
  if (typeof amount !== 'number') {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        email: true,
        name: true,
        publicId: true,
        businessType: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        timezone: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const selectedDate = searchParams.get('date') || formatLocalDate(new Date(), business.timezone);
    const startOfDay = businessDayStart(selectedDate, business.timezone);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const checkIns = await prisma.checkIn.findMany({
      where: {
        businessId: business.id,
        checkInTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            lastVisit: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
      take: 30,
    });

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        publicId: business.publicId,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      selectedDate,
      dateLabel: formatDateLabel(selectedDate, business.timezone),
      timezone: business.timezone,
      count: checkIns.length,
      latestCheckInLabel: checkIns.length
        ? formatTimeLabel(checkIns[0].checkInTime.toISOString(), business.timezone)
        : null,
      checkIns: checkIns.map((checkIn) => ({
        id: checkIn.id,
        customerId: checkIn.customer.id,
        customerName: checkIn.customer.name,
        phoneDisplay: formatPhoneForDisplay(checkIn.customer.phone),
        serviceName: checkIn.service?.name ?? null,
        staffName: checkIn.staff?.fullName ?? null,
        amountSpentLabel: formatCurrency(checkIn.amountSpent),
        checkedInAtLabel: formatTimeLabel(checkIn.checkInTime.toISOString(), business.timezone),
        lastVisitLabel: formatLastVisit(checkIn.customer.lastVisit?.toISOString(), business.timezone),
      })),
    });
  } catch (error) {
    console.error('GET /api/mobile/checkins error:', error);
    return NextResponse.json({ error: 'Unable to load mobile check-ins' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const body = await request.json();
    const { customerId, phone, customerName, customerEmail } = body ?? {};

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        timezone: true,
      },
    });
    const timezone = business?.timezone ?? 'America/New_York';

    const { checkIn } = await createBusinessCheckIn({
      businessId: session.businessId,
      customerId,
      phone,
      customerName,
      customerEmail,
    });

    return NextResponse.json({
      checkIn: {
        id: checkIn.id,
        customerId: checkIn.customerId,
        customerName: checkIn.customer.name,
        phoneDisplay: formatPhoneForDisplay(checkIn.customer.phone),
        serviceName: checkIn.service?.name ?? null,
        staffName: checkIn.staff?.fullName ?? null,
        amountSpentLabel: formatCurrency(checkIn.amountSpent),
        checkedInAtLabel: formatTimeLabel(checkIn.checkInTime.toISOString(), timezone),
        lastVisitLabel: formatLastVisit(checkIn.customer.lastVisit?.toISOString(), timezone),
      },
    });
  } catch (error) {
    if (error instanceof CheckInFlowError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
          ...(error.customers ? { customers: error.customers } : {}),
        },
        { status: error.status },
      );
    }

    console.error('POST /api/mobile/checkins error:', error);
    return NextResponse.json({ error: 'Unable to create mobile check-in' }, { status: 500 });
  }
}
