import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { normalizeBusinessClosureDates } from '@/lib/business-closures';
import { normalizeBusinessHoursRecord } from '@/lib/staff-schedule';
import { requireMobileSession } from '@/lib/mobile-route';

type HoursArrayItem = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDefaultHours(): HoursArrayItem[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek >= 1 && dayOfWeek <= 5,
    openTime: dayOfWeek >= 1 && dayOfWeek <= 5 ? '09:00' : null,
    closeTime: dayOfWeek >= 1 && dayOfWeek <= 5 ? '17:00' : null,
  }));
}

function parseHoursRecord(hours: unknown): HoursArrayItem[] {
  return Object.entries(normalizeBusinessHoursRecord(hours))
    .map(([day, value]) => ({
      dayOfWeek: Number.parseInt(day, 10),
      isOpen: Boolean(value?.isOpen),
      openTime: value?.openTime ?? null,
      closeTime: value?.closeTime ?? null,
    }))
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek);
}

function formatTimeLabel(value: string | null) {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeRange(openTime: string | null, closeTime: string | null) {
  if (!openTime || !closeTime) {
    return 'Closed';
  }

  return `${formatTimeLabel(openTime)} - ${formatTimeLabel(closeTime)}`;
}

function formatClosureDate(date: string, timezone: string) {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
}

async function fetchBusinessHoursPayload(businessId: string) {
  const [business, businessHours, closureDates] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        email: true,
        name: true,
        businessType: true,
        timezone: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
      },
    }),
    prisma.businessHours.findUnique({
      where: { businessId },
    }),
    prisma.businessClosureDate.findMany({
      where: { businessId },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        label: true,
      },
    }),
  ]);

  if (!business) {
    return null;
  }

  const timezone = business.timezone || 'America/New_York';
  const hours = businessHours ? parseHoursRecord(businessHours.hours) : getDefaultHours();

  return {
    business: {
      id: business.id,
      email: business.email,
      name: business.name,
      businessType: business.businessType,
      onboardingComplete: isBusinessOnboardingComplete(business),
    },
    timezone,
    timezoneLabel: timezone.replaceAll('_', ' '),
    openDayCount: hours.filter((hour) => hour.isOpen).length,
    closureCount: closureDates.length,
    hours: hours.map((hour) => ({
      ...hour,
      label: DAYS[hour.dayOfWeek] ?? `Day ${hour.dayOfWeek}`,
      timeRangeLabel: hour.isOpen
        ? formatTimeRange(hour.openTime, hour.closeTime)
        : 'Closed',
    })),
    closures: closureDates.map((closure) => ({
      date: closure.date,
      label: closure.label,
      formattedDate: formatClosureDate(closure.date, timezone),
    })),
  };
}

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const payload = await fetchBusinessHoursPayload(authorized.session.businessId);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('GET /api/mobile/business-hours error:', error);
    return NextResponse.json({ error: 'Unable to load business hours' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const hours = Array.isArray(body.hours) ? body.hours : null;
  const closuresInput = Array.isArray(body.closures) ? body.closures : [];

  if (!hours) {
    return NextResponse.json({ error: 'Hours are required.' }, { status: 400 });
  }

  const normalizedClosures = normalizeBusinessClosureDates(closuresInput);
  if (normalizedClosures.length !== closuresInput.length) {
    return NextResponse.json({ error: 'One or more closure dates are invalid.' }, { status: 400 });
  }

  const hoursJson: Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }> = {};

  for (const hour of hours) {
    if (
      !hour ||
      typeof hour !== 'object' ||
      !Number.isInteger((hour as { dayOfWeek?: number }).dayOfWeek)
    ) {
      return NextResponse.json({ error: 'Hours are invalid.' }, { status: 400 });
    }

    const dayOfWeek = (hour as { dayOfWeek: number }).dayOfWeek;
    hoursJson[String(dayOfWeek)] = {
      isOpen: Boolean((hour as { isOpen?: boolean }).isOpen),
      openTime:
        typeof (hour as { openTime?: string | null }).openTime === 'string'
          ? (hour as { openTime: string }).openTime
          : null,
      closeTime:
        typeof (hour as { closeTime?: string | null }).closeTime === 'string'
          ? (hour as { closeTime: string }).closeTime
          : null,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.businessHours.upsert({
        where: { businessId: authorized.session.businessId },
        update: { hours: hoursJson },
        create: {
          businessId: authorized.session.businessId,
          hours: hoursJson,
        },
      });

      await tx.businessClosureDate.deleteMany({
        where: { businessId: authorized.session.businessId },
      });

      if (normalizedClosures.length) {
        await tx.businessClosureDate.createMany({
          data: normalizedClosures.map((closure) => ({
            businessId: authorized.session.businessId,
            date: closure.date,
            label: closure.label ?? null,
          })),
        });
      }
    });

    const payload = await fetchBusinessHoursPayload(authorized.session.businessId);
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error('PATCH /api/mobile/business-hours error:', error);
    return NextResponse.json({ error: 'Unable to update business hours' }, { status: 500 });
  }
}
