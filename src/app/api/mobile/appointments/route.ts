import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { businessDayStart } from '@/lib/timezone';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import {
  collectAppointmentServiceIds,
  withAppointmentServiceDisplay,
} from '@/lib/appointment-services';

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

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatSourceLabel(source: string) {
  if (source === 'dashboard') return 'Manual';
  if (source === 'online_booking') return 'Online booking';
  if (source === 'public_booking') return 'Public booking';
  return formatStatusLabel(source);
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
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId: business.id,
        startTime: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
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
        startTime: 'asc',
      },
      take: 40,
    });

    const serviceIds = collectAppointmentServiceIds(appointments);
    const services =
      serviceIds.length > 0
        ? await prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true },
          })
        : [];
    const appointmentsWithServices = withAppointmentServiceDisplay(appointments, services);

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      selectedDate,
      dateLabel: formatDateLabel(selectedDate, business.timezone),
      timezone: business.timezone,
      counts: {
        total: appointmentsWithServices.length,
        pending: appointmentsWithServices.filter((appointment) => appointment.status === 'pending')
          .length,
        confirmed: appointmentsWithServices.filter(
          (appointment) => appointment.status === 'confirmed',
        ).length,
        scheduled: appointmentsWithServices.filter(
          (appointment) => appointment.status === 'scheduled',
        ).length,
      },
      appointments: appointmentsWithServices.map((appointment) => ({
        id: appointment.id,
        customerName: appointment.customer.name,
        serviceName: appointment.serviceDisplayName || appointment.service?.name || 'Service',
        staffName: appointment.staff?.fullName ?? null,
        status: appointment.status,
        statusLabel: formatStatusLabel(appointment.status),
        startTimeLabel: formatTimeLabel(appointment.startTime.toISOString(), business.timezone),
        endTimeLabel: formatTimeLabel(appointment.endTime.toISOString(), business.timezone),
        sourceLabel: formatSourceLabel(appointment.source),
        notes: appointment.notes,
      })),
    });
  } catch (error) {
    console.error('GET /api/mobile/appointments error:', error);
    return NextResponse.json({ error: 'Unable to load mobile appointments' }, { status: 500 });
  }
}
