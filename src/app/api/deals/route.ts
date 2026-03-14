import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

function parseDealDate(value: string, endOfDay: boolean): Date | null {
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const parsed = dateOnlyPattern.test(value)
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deals = await prisma.deal.findMany({
      where: { businessId: session.user.id },
      include: {
        service: { select: { name: true } },
        redemptions: { orderBy: { createdAt: 'desc' } },
        notificationSends: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            createdAt: true,
            customerId: true,
            customerName: true,
            customerPhone: true,
            code: true,
            status: true,
            errorMessage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const withStats = deals.map(deal => ({
      ...deal,
      revenueTracked: deal.redemptions.reduce((s: number, r: any) => s + (r.transactionAmount ?? 0), 0),
      platformFeesOwed: deal.redemptions.reduce((s: number, r: any) => s + (r.platformFee ?? 0), 0),
    }));

    return NextResponse.json({ deals: withStats });
  } catch (error: any) {
    console.error('GET /api/deals error:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const body = await req.json();
    const { title, description, discountType, discountValue, serviceId, startsAt, expiresAt, maxRedemptions } = body;

    if (!title || !discountType || !startsAt || !expiresAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Deal title', value: title },
      { label: 'Deal description', value: description },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (discountType !== 'free_service' && (discountValue === undefined || discountValue === null)) {
      return NextResponse.json({ error: 'discountValue required for this discount type' }, { status: 400 });
    }

    const parsedStartsAt = parseDealDate(startsAt, false);
    const parsedExpiresAt = parseDealDate(expiresAt, true);
    if (!parsedStartsAt || !parsedExpiresAt) {
      return NextResponse.json({ error: 'Invalid deal dates' }, { status: 400 });
    }
    if (parsedExpiresAt <= parsedStartsAt) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const deal = await prisma.deal.create({
      data: {
        businessId: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        discountType,
        discountValue: discountType === 'free_service' ? 0 : Number(discountValue),
        serviceId: serviceId || null,
        startsAt: parsedStartsAt,
        expiresAt: parsedExpiresAt,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      },
      include: { service: { select: { name: true } } },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/deals error:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
