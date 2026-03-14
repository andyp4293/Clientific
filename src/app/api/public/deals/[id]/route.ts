import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        service: { select: { name: true } },
        business: { select: { name: true, slug: true, publicId: true, city: true, state: true } },
      },
    });

    if (!deal || !deal.active) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const now = new Date();
    if (deal.startsAt > now || deal.expiresAt <= now) {
      return NextResponse.json({ error: 'Deal is not currently active' }, { status: 404 });
    }

    if (deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions) {
      return NextResponse.json({ error: 'Deal is sold out' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const sessionBusinessId = getSessionBusinessId(session);

    return NextResponse.json({
      deal: {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        discountType: deal.discountType,
        discountValue: deal.discountValue,
        startsAt: deal.startsAt,
        expiresAt: deal.expiresAt,
        service: deal.service ? { name: deal.service.name } : null,
        business: deal.business,
        viewerCanManage: sessionBusinessId === deal.businessId,
      },
    });
  } catch (error: any) {
    console.error('GET /api/public/deals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 });
  }
}
