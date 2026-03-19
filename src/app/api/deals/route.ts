import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import {
  isDealEndSameOrBeforeStart,
  isDealStartBeforeToday,
  parseDealDate,
} from '@/lib/deal-dates';
import { dealRequiresPayoutSetup, getPaidDealPayoutStatus } from '@/lib/paid-deal-payouts';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

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
        eligibleServices: {
          select: {
            id: true,
            name: true,
            price: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        redemptions: { orderBy: { createdAt: 'desc' } },
        purchases: {
          where: { status: 'paid' },
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                serviceName: true,
                quantity: true,
                originalUnitAmount: true,
                discountedUnitAmount: true,
              },
            },
          },
        },
        notificationSends: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            createdAt: true,
            customerId: true,
            customerName: true,
            customerPhone: true,
            code: true,
            purchaseUrl: true,
            deliveryType: true,
            status: true,
            errorMessage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const withStats = deals.map((deal: any) => {
      const purchases = deal.purchases ?? [];
      const redemptions = deal.redemptions ?? [];
      return {
        ...deal,
        purchases,
        redemptions,
        eligibleServices: deal.eligibleServices ?? [],
        notificationSends: deal.notificationSends ?? [],
        revenueTracked:
          purchases.reduce((sum: number, purchase: any) => sum + purchase.totalAmount / 100, 0) +
          redemptions.reduce((sum: number, redemption: any) => sum + (redemption.transactionAmount ?? 0), 0),
        platformFeesOwed:
          purchases.reduce((sum: number, purchase: any) => sum + purchase.applicationFeeAmount / 100, 0) +
          redemptions.reduce((sum: number, redemption: any) => sum + (redemption.platformFee ?? 0), 0),
      };
    });

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
    const {
      title,
      description,
      discountType,
      discountValue,
      serviceId,
      serviceScope: rawServiceScope,
      deliveryType: rawDeliveryType,
      eligibleServiceIds: rawEligibleServiceIds,
      active: rawActive,
      startsAt,
      expiresAt,
      maxRedemptions,
    } = body;

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

    const numericDiscount = discountType === 'free_service' ? 0 : Number(discountValue);
    if (discountType === 'percent_off' && (numericDiscount <= 0 || numericDiscount > 100)) {
      return NextResponse.json({ error: 'Percent discount must be between 1% and 100%' }, { status: 400 });
    }
    if (discountType === 'amount_off' && numericDiscount <= 0) {
      return NextResponse.json({ error: 'Dollar discount must be greater than $0' }, { status: 400 });
    }

    const parsedStartsAt = parseDealDate(startsAt, false);
    const parsedExpiresAt = parseDealDate(expiresAt, true);
    if (!parsedStartsAt || !parsedExpiresAt) {
      return NextResponse.json({ error: 'Invalid deal dates' }, { status: 400 });
    }
    if (isDealStartBeforeToday(parsedStartsAt)) {
      return NextResponse.json({ error: 'Start date cannot be earlier than today' }, { status: 400 });
    }
    if (isDealEndSameOrBeforeStart(parsedStartsAt, parsedExpiresAt)) {
      return NextResponse.json({ error: 'End date must be at least one day after start date' }, { status: 400 });
    }

    const deliveryType =
      rawDeliveryType === 'code_claim' ? 'code_claim' : 'purchase_link';
    const active = rawActive === false ? false : true;
    const serviceScope =
      rawServiceScope === 'all_services'
        ? 'all_services'
        : rawServiceScope === 'selected_services'
          ? 'selected_services'
          : serviceId
            ? 'selected_services'
            : 'all_services';
    const eligibleServiceIds = Array.isArray(rawEligibleServiceIds)
      ? rawEligibleServiceIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    let eligibleServicesConnect:
      | {
          connect: { id: string }[];
        }
      | undefined;

    if (deliveryType === 'purchase_link') {
      if (serviceScope === 'selected_services') {
        const combinedServiceIds = Array.from(
          new Set([...(serviceId ? [serviceId] : []), ...eligibleServiceIds])
        );

        if (combinedServiceIds.length === 0) {
          return NextResponse.json(
            { error: 'Choose at least one eligible service for this deal' },
            { status: 400 }
          );
        }

        const validServices = await prisma.service.findMany({
          where: {
            businessId: session.user.id,
            id: { in: combinedServiceIds },
            active: true,
          },
          select: { id: true },
        });

        if (validServices.length !== combinedServiceIds.length) {
          return NextResponse.json(
            { error: 'One or more selected services are invalid for this deal' },
            { status: 400 }
          );
        }

        eligibleServicesConnect = {
          connect: validServices.map((service) => ({ id: service.id })),
        };
      }
    }

    if (
      active &&
      dealRequiresPayoutSetup({
        deliveryType,
        discountType,
        discountValue: numericDiscount,
      })
    ) {
      const business = await prisma.business.findUnique({
        where: { id: session.user.id },
        select: {
          stripeConnectAccountId: true,
          stripeConnectChargesEnabled: true,
          stripeConnectPayoutsEnabled: true,
          stripeConnectDetailsSubmitted: true,
        },
      });

      const payoutStatus = getPaidDealPayoutStatus({
        stripeConnectAccountId: business?.stripeConnectAccountId ?? null,
        stripeConnectChargesEnabled: business?.stripeConnectChargesEnabled ?? false,
        stripeConnectPayoutsEnabled: business?.stripeConnectPayoutsEnabled ?? false,
        stripeConnectDetailsSubmitted: business?.stripeConnectDetailsSubmitted ?? false,
      });

      if (!payoutStatus.ready) {
        return NextResponse.json({ error: payoutStatus.message }, { status: 409 });
      }
    }

    const deal = await prisma.deal.create({
      data: {
        businessId: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        active,
        deliveryType,
        serviceScope,
        discountType,
        discountValue: discountType === 'free_service' ? 0 : Number(discountValue),
        serviceId: deliveryType === 'code_claim' ? serviceId || null : null,
        ...(eligibleServicesConnect && { eligibleServices: eligibleServicesConnect }),
        startsAt: parsedStartsAt,
        expiresAt: parsedExpiresAt,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      },
      include: {
        service: { select: { name: true } },
        eligibleServices: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/deals error:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}
