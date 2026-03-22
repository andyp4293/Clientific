import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { normalizeBusinessClosureDates } from '@/lib/business-closures';
import { normalizeBusinessHoursRecord } from '@/lib/staff-schedule';
import { authOptions } from '../auth/[...nextauth]/route';

type HoursArrayItem = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
};

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
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

async function requireBusinessId(): Promise<string | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return session.user.id;
}

export async function GET(_req: NextRequest) {
  try {
    const businessIdOrResponse = await requireBusinessId();
    if (businessIdOrResponse instanceof NextResponse) {
      return businessIdOrResponse;
    }

    const businessId = businessIdOrResponse;
    const [businessHours, closureDates] = await Promise.all([
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

    return NextResponse.json({
      businessHours: businessHours ? parseHoursRecord(businessHours.hours) : getDefaultHours(),
      closureDates,
    });
  } catch (error: any) {
    console.error('Error fetching business hours:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business hours' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const businessIdOrResponse = await requireBusinessId();
    if (businessIdOrResponse instanceof NextResponse) {
      return businessIdOrResponse;
    }

    const businessId = businessIdOrResponse;
    const body = await req.json();
    const { hours, closures } = body;

    if (!Array.isArray(hours)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const normalizedClosures = normalizeBusinessClosureDates(closures);
    if (closures !== undefined && normalizedClosures.length !== closures.length) {
      return NextResponse.json(
        { error: 'One or more closed dates are invalid' },
        { status: 400 }
      );
    }

    const hoursJson: Record<string, { isOpen: boolean; openTime: string | null; closeTime: string | null }> = {};
    for (const hour of hours) {
      hoursJson[String(hour.dayOfWeek)] = {
        isOpen: Boolean(hour.isOpen),
        openTime: typeof hour.openTime === 'string' ? hour.openTime : null,
        closeTime: typeof hour.closeTime === 'string' ? hour.closeTime : null,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.businessHours.upsert({
        where: { businessId },
        update: { hours: hoursJson },
        create: {
          businessId,
          hours: hoursJson,
        },
      });

      if (closures !== undefined) {
        await tx.businessClosureDate.deleteMany({
          where: { businessId },
        });

        if (normalizedClosures.length > 0) {
          await tx.businessClosureDate.createMany({
            data: normalizedClosures.map((closure) => ({
              businessId,
              date: closure.date,
              label: closure.label ?? null,
            })),
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating business hours:', error);
    return NextResponse.json(
      { error: 'Failed to update business hours' },
      { status: 500 }
    );
  }
}
