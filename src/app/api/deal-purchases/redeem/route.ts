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

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : null;
    const purchaseId = typeof body.purchaseId === 'string' ? body.purchaseId.trim() : null;

    if (!code && !purchaseId) {
      return NextResponse.json({ error: 'purchaseId or code is required' }, { status: 400 });
    }

    const purchase = await prisma.dealPurchase.findFirst({
      where: {
        businessId,
        OR: [
          ...(purchaseId ? [{ id: purchaseId }] : []),
          ...(code ? [{ redemptionCode: code }] : []),
        ],
      },
      include: {
        deal: {
          select: {
            title: true,
            discountType: true,
            discountValue: true,
          },
        },
        items: {
          select: {
            serviceName: true,
            quantity: true,
            originalUnitAmount: true,
            discountedUnitAmount: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    if (!purchase.redemptionCode) {
      return NextResponse.json({ error: 'This purchase does not have a redemption code yet' }, { status: 400 });
    }

    const redeemedAt = purchase.redeemedAt ?? new Date();
    const alreadyRedeemed = Boolean(purchase.redeemedAt);

    if (!alreadyRedeemed) {
      await prisma.dealPurchase.update({
        where: { id: purchase.id },
        data: {
          redeemedAt,
          status: 'redeemed',
        },
      });
    }

    return NextResponse.json({
      success: true,
      alreadyRedeemed,
      purchase: {
        id: purchase.id,
        redemptionCode: purchase.redemptionCode,
        redeemedAt,
        purchasedAt: purchase.purchasedAt,
        totalAmount: purchase.totalAmount,
        customerName: purchase.customerName,
        customerPhone: purchase.customerPhone,
        deal: purchase.deal,
        items: purchase.items,
      },
    });
  } catch (error: any) {
    console.error('POST /api/deal-purchases/redeem error:', error);
    return NextResponse.json({ error: 'Failed to redeem purchase' }, { status: 500 });
  }
}
