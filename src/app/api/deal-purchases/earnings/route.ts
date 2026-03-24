import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { getSessionBusinessId } from '@/lib/session-business';

const dollarsToCents = (value: number) => Math.round(value * 100);

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [purchases, referralCommissions] = await Promise.all([
      prisma.dealPurchase.findMany({
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
      }),
      prisma.referralCommission.findMany({
        where: {
          referral: {
            referrerId: businessId,
          },
        },
        select: {
          id: true,
          createdAt: true,
          amountDollars: true,
          transferStatus: true,
          transferredAt: true,
          referral: {
            select: {
              referee: {
                select: {
                  name: true,
                  email: true,
                  businessEmail: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const dealEntries = purchases.map((purchase) => ({
      id: purchase.id,
      kind: 'deal' as const,
      sourceName: purchase.deal.title,
      detailLabel: purchase.customerName,
      detailPhone: purchase.customerPhone,
      occurredAt: purchase.purchasedAt?.toISOString() ?? null,
      grossAmount: purchase.totalAmount,
      feeAmount: purchase.applicationFeeAmount,
      netAmount: purchase.businessNetAmount,
      status: purchase.status,
    }));

    const referralEntries = referralCommissions.map((commission) => {
      const amountCents = dollarsToCents(commission.amountDollars);
      const referee = commission.referral.referee;

      return {
        id: commission.id,
        kind: 'referral' as const,
        sourceName:
          referee.name || referee.businessEmail || referee.email || 'Referred business',
        detailLabel: referee.businessEmail || referee.email || 'Referral subscription commission',
        detailPhone: null,
        occurredAt: (commission.transferredAt ?? commission.createdAt)?.toISOString() ?? null,
        grossAmount: amountCents,
        feeAmount: 0,
        netAmount: amountCents,
        status: commission.transferStatus,
      };
    });

    const entries = [...dealEntries, ...referralEntries].sort((left, right) => {
      const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
      const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
      return rightTime - leftTime;
    });

    const dealGross = dealEntries.reduce((sum, entry) => sum + entry.grossAmount, 0);
    const dealFees = dealEntries.reduce((sum, entry) => sum + entry.feeAmount, 0);
    const dealNet = dealEntries.reduce((sum, entry) => sum + entry.netAmount, 0);
    const referralNet = referralEntries.reduce((sum, entry) => sum + entry.netAmount, 0);

    return NextResponse.json({
      entries,
      totals: {
        dealGross,
        dealFees,
        dealNet,
        dealCount: dealEntries.length,
        referralNet,
        referralCount: referralEntries.length,
        totalNet: dealNet + referralNet,
        entryCount: entries.length,
      },
    });
  } catch (error: any) {
    console.error('GET /api/deal-purchases/earnings error:', error);
    return NextResponse.json({ error: 'Failed to load earnings' }, { status: 500 });
  }
}
