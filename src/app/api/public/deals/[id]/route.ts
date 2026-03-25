import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dealRequiresPayoutSetup, isBusinessReadyForPaidDeals } from '@/lib/paid-deal-payouts';
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
        eligibleServices: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
            active: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            publicId: true,
            city: true,
            state: true,
            stripeConnectAccountId: true,
            stripeConnectChargesEnabled: true,
            stripeConnectPayoutsEnabled: true,
            stripeConnectDetailsSubmitted: true,
            services: {
              where: { active: true },
              select: {
                id: true,
                name: true,
                price: true,
                duration: true,
                active: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
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

    if (dealRequiresPayoutSetup(deal) && !isBusinessReadyForPaidDeals(deal.business)) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const sessionBusinessId = getSessionBusinessId(session);

    return NextResponse.json({
      deal: {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        deliveryType: deal.deliveryType,
        serviceScope: deal.serviceScope,
        discountType: deal.discountType,
        discountValue: deal.discountValue,
        newCustomersOnly: deal.newCustomersOnly,
        startsAt: deal.startsAt,
        expiresAt: deal.expiresAt,
        service: deal.service ? { name: deal.service.name } : null,
        selectableServices:
          deal.deliveryType === 'purchase_link'
            ? (deal.serviceScope === 'all_services'
                ? deal.business.services
                : deal.eligibleServices
              ).map((service) => ({
                id: service.id,
                name: service.name,
                price: service.price,
                duration: service.duration,
              }))
            : [],
        business: {
          id: deal.business.id,
          name: deal.business.name,
          slug: deal.business.slug,
          publicId: deal.business.publicId,
          city: deal.business.city,
          state: deal.business.state,
        },
        viewerCanManage: sessionBusinessId === deal.businessId,
      },
    });
  } catch (error: any) {
    console.error('GET /api/public/deals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch deal' }, { status: 500 });
  }
}
