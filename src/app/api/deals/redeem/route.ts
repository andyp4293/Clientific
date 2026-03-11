import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : null;
    const transactionAmount = typeof body.transactionAmount === 'number' ? body.transactionAmount : null;

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

    if (redemption.usedAt !== null) {
      return NextResponse.json({ error: 'Code already used' }, { status: 400 });
    }

    const platformFeePercent = (redemption.deal as any).platformFeePercent ?? 15;
    const platformFee =
      transactionAmount !== null
        ? Math.round(transactionAmount * platformFeePercent) / 100
        : null;

    await prisma.dealRedemption.update({
      where: { code },
      data: {
        usedAt: new Date(),
        transactionAmount: transactionAmount ?? null,
        platformFee,
      } as any,
    });

    return NextResponse.json({
      success: true,
      deal: {
        title: redemption.deal.title,
        discountType: redemption.deal.discountType,
        discountValue: redemption.deal.discountValue,
      },
      customer: redemption.customer ?? null,
      platformFee,
    });
  } catch (error: any) {
    console.error('POST /api/deals/redeem error:', error);
    return NextResponse.json({ error: 'Failed to redeem code' }, { status: 500 });
  }
}
