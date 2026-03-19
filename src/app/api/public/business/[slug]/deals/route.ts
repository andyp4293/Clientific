import { NextRequest, NextResponse } from 'next/server';
import { dealRequiresPayoutSetup, isBusinessReadyForPaidDeals } from '@/lib/paid-deal-payouts';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Support both slug and publicId
    const isPublicId = /^[A-Z]{2}-[A-Z0-9]{6}$/.test(slug);
    const business = await prisma.business.findFirst({
      where: isPublicId ? { publicId: slug } : { slug },
      select: {
        id: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const now = new Date();
    const deals = await prisma.deal.findMany({
      where: {
        businessId: business.id,
        active: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      include: { service: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out deals that hit max redemptions
    const available = deals.filter((deal) => {
      const withinRedemptionLimit =
        deal.maxRedemptions === null || deal.redemptionCount < deal.maxRedemptions;
      const payoutReady =
        !dealRequiresPayoutSetup(deal) || isBusinessReadyForPaidDeals(business);

      return withinRedemptionLimit && payoutReady;
    });

    return NextResponse.json({ deals: available });
  } catch (error: any) {
    console.error('GET public deals error:', error);
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 });
  }
}
