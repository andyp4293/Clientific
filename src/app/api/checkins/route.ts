import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { CheckInFlowError, createBusinessCheckIn } from '@/lib/checkins';
import { businessDayStart } from '@/lib/timezone';
import { requireActiveSubscription } from '@/lib/subscription';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: { timezone: true },
    });
    const timezone = business?.timezone ?? 'America/New_York';

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    const where: any = { businessId: session.user.businessId };

    if (date) {
      const startOfDay = businessDayStart(date, timezone);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
      where.checkInTime = { gte: startOfDay, lte: endOfDay };
    }

    const checkIns = await prisma.checkIn.findMany({
      where,
      include: {
        customer: true,
        service: true,
        staff: true,
      },
      orderBy: { checkInTime: 'desc' },
    });

    return NextResponse.json({ checkIns, timezone });
  } catch (error) {
    console.error('GET /api/checkins error:', error);
    return NextResponse.json({ error: 'Failed to fetch check-ins' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const body = await req.json();
    const {
      customerId,
      serviceId,
      staffId,
      amountSpent,
      phone,
      customerName,
      customerEmail,
    } = body;

    const { checkIn } = await createBusinessCheckIn({
      businessId: session.user.businessId,
      customerId,
      serviceId,
      staffId,
      amountSpent,
      phone,
      customerName,
      customerEmail,
    });

    return NextResponse.json({ checkIn });
  } catch (error) {
    if (error instanceof CheckInFlowError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
          ...(error.customers ? { customers: error.customers } : {}),
        },
        { status: error.status }
      );
    }
    console.error('POST /api/checkins error:', error);
    return NextResponse.json({ error: 'Failed to create check-in' }, { status: 500 });
  }
}
