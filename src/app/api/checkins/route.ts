import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { updateCustomerSegment } from '@/lib/segment';
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
    const { customerId, serviceId, staffId, amountSpent } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    // Get business settings for points calculation
    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: {
        pointsPerVisit: true,
        pointsPerDollar: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Calculate points earned
    let pointsEarned = business.pointsPerVisit || 10;
    if (amountSpent && business.pointsPerDollar) {
      pointsEarned += Math.floor(amountSpent * business.pointsPerDollar);
    }

    // Create check-in
    const checkIn = await prisma.checkIn.create({
      data: {
        businessId: session.user.businessId,
        customerId,
        serviceId: serviceId || undefined,
        staffId: staffId || undefined,
        amountSpent: amountSpent || undefined,
        pointsEarned,
        checkInTime: new Date(),
      },
      include: {
        customer: true,
        service: true,
        staff: true,
      },
    });    // Update customer points and stats
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        points: { increment: pointsEarned },
        lastVisit: new Date(),
        totalSpent: amountSpent ? { increment: amountSpent } : undefined,
      },
    });

    // Create points transaction record
    await prisma.pointsTransaction.create({
      data: {
        customerId,
        amount: pointsEarned,
        description: 'Check-in points',
        balanceAfter: updatedCustomer.points,
      },
    });

    // Update customer segment based on new visit/spend data
    updateCustomerSegment(customerId).catch(console.error);

    return NextResponse.json({ checkIn });
  } catch (error) {
    console.error('POST /api/checkins error:', error);
    return NextResponse.json({ error: 'Failed to create check-in' }, { status: 500 });
  }
}
