import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import {
  buildCustomerPhoneMatchClauses,
  formatPhoneForDisplay,
  normalizeOptionalStoredPhoneNumber,
} from '@/lib/phone';

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
    if (session.accountType === 'staff') {
      return NextResponse.json(
        { error: 'Employee accounts can only access assigned appointments.' },
        { status: 403 },
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const phone = searchParams.get('phone');
    const normalizedPhone = normalizeOptionalStoredPhoneNumber(phone);
    const matchClauses = buildCustomerPhoneMatchClauses(phone);

    if (!normalizedPhone || matchClauses.length === 0) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        timezone: true,
      },
    });
    const timezone = business?.timezone ?? 'America/New_York';

    const customers = await prisma.customer.findMany({
      where: {
        businessId: session.businessId,
        OR: matchClauses,
      },
      orderBy: [{ lastVisit: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        lastVisit: true,
      },
      take: 5,
    });

    if (customers.length === 0) {
      return NextResponse.json({
        status: 'new',
        normalizedPhone,
        displayPhone: formatPhoneForDisplay(normalizedPhone),
      });
    }

    if (customers.length === 1) {
      return NextResponse.json({
        status: 'existing',
        customer: {
          ...customers[0],
          phoneDisplay: formatPhoneForDisplay(customers[0].phone),
          lastVisitLabel: formatLastVisit(customers[0].lastVisit?.toISOString(), timezone),
        },
      });
    }

    return NextResponse.json({
      status: 'multiple',
      customers: customers.map((customer) => ({
        ...customer,
        phoneDisplay: formatPhoneForDisplay(customer.phone),
        lastVisitLabel: formatLastVisit(customer.lastVisit?.toISOString(), timezone),
      })),
    });
  } catch (error) {
    console.error('GET /api/mobile/checkins/lookup error:', error);
    return NextResponse.json({ error: 'Unable to look up mobile check-ins' }, { status: 500 });
  }
}
