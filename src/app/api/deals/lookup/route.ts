import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code')?.trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const redemption = await prisma.dealRedemption.findUnique({
      where: { code },
      include: {
        deal: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    if (!redemption) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    if (redemption.deal.businessId !== businessId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      deal: {
        title: redemption.deal.title,
        discountType: redemption.deal.discountType,
        discountValue: redemption.deal.discountValue,
        platformFeePercent: (redemption.deal as any).platformFeePercent ?? 10,
      },
      customer: redemption.customer ?? null,
      alreadyUsed: redemption.usedAt !== null,
    });
  } catch (error: any) {
    console.error('GET /api/deals/lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up code' }, { status: 500 });
  }
}
