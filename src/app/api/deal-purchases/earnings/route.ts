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

    const purchases = await prisma.dealPurchase.findMany({
      where: {
        businessId,
        status: { in: ['paid', 'redeemed'] },
      },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        applicationFeeAmount: true,
        businessNetAmount: true,
        status: true,
        purchasedAt: true,
        redeemedAt: true,
        redemptionCode: true,
        deal: { select: { title: true } },
      },
      orderBy: { purchasedAt: 'desc' },
      take: 100,
    });

    const transactions = purchases.map((purchase) => ({
      id: purchase.id,
      dealTitle: purchase.deal.title,
      customerName: purchase.customerName,
      customerPhone: purchase.customerPhone,
      purchasedAt: purchase.purchasedAt?.toISOString() ?? null,
      totalAmount: purchase.totalAmount,
      applicationFeeAmount: purchase.applicationFeeAmount,
      businessNetAmount: purchase.businessNetAmount,
      status: purchase.status,
      redeemedAt: purchase.redeemedAt?.toISOString() ?? null,
      redemptionCode: purchase.redemptionCode,
    }));

    const totalGross = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalFees = transactions.reduce((sum, t) => sum + t.applicationFeeAmount, 0);
    const totalNet = transactions.reduce((sum, t) => sum + t.businessNetAmount, 0);

    return NextResponse.json({
      transactions,
      totals: {
        totalGross,
        totalFees,
        totalNet,
        transactionCount: transactions.length,
      },
    });
  } catch (error: any) {
    console.error('GET /api/deal-purchases/earnings error:', error);
    return NextResponse.json({ error: 'Failed to load earnings' }, { status: 500 });
  }
}
