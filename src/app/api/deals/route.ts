import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

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
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ deals });
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

    const body = await req.json();
    const { title, description, discountType, discountValue, serviceId, startsAt, expiresAt, maxRedemptions } = body;

    if (!title || !discountType || !startsAt || !expiresAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (discountType !== 'free_service' && (discountValue === undefined || discountValue === null)) {
      return NextResponse.json({ error: 'discountValue required for this discount type' }, { status: 400 });
    }

    const deal = await prisma.deal.create({
      data: {
        businessId: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        discountType,
        discountValue: discountType === 'free_service' ? 0 : Number(discountValue),
        serviceId: serviceId || null,
        startsAt: new Date(startsAt),
        expiresAt: new Date(expiresAt),
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
