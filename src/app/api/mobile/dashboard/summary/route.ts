import { NextResponse } from 'next/server';
import { startOfMonth } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { localToUTC } from '@/lib/timezone';

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

function formatTimeLabel(isoString: string, timezone: string) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const session = await verifyMobileSessionToken(token);

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        trialEndsAt: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayKey = formatLocalDate(new Date(), business.timezone);
    const startOfToday = localToUTC(todayKey, 0, 0, business.timezone);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    const monthStart = startOfMonth(new Date());

    const [totalCustomers, newCustomersThisMonth, checkInsToday, appointmentsToday] =
      await Promise.all([
        prisma.customer.count({ where: { businessId: business.id } }),
        prisma.customer.count({
          where: { businessId: business.id, createdAt: { gte: monthStart } },
        }),
        prisma.checkIn.count({
          where: { businessId: business.id, checkInTime: { gte: startOfToday, lte: endOfToday } },
        }),
        prisma.appointment.findMany({
          where: {
            businessId: business.id,
            startTime: { gte: startOfToday, lte: endOfToday },
            status: { in: ['pending', 'scheduled', 'confirmed'] },
          },
          orderBy: { startTime: 'asc' },
          take: 5,
          include: {
            customer: { select: { name: true } },
            service: { select: { name: true } },
          },
        }),
      ]);

    const trialDaysRemaining = business.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(business.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      metrics: [
        {
          label: 'Customers',
          value: totalCustomers,
          helper: `+${newCustomersThisMonth} this month`,
        },
        {
          label: 'Appointments Today',
          value: appointmentsToday.length,
          helper: 'Scheduled',
        },
        {
          label: 'Check-Ins',
          value: checkInsToday,
          helper: 'Today',
        },
        {
          label: 'New Customers',
          value: newCustomersThisMonth,
          helper: 'This month',
        },
      ],
      upcomingAppointments: appointmentsToday.map((appointment) => ({
        id: appointment.id,
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name ?? 'Service',
        status: appointment.status,
        startTime: appointment.startTime,
        startTimeLabel: formatTimeLabel(appointment.startTime.toISOString(), business.timezone),
      })),
      trialDaysRemaining,
    });
  } catch (error) {
    console.error('GET /api/mobile/dashboard/summary error:', error);
    return NextResponse.json({ error: 'Unable to load mobile dashboard' }, { status: 401 });
  }
}
