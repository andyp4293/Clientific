import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { getPaidDealPayoutStatus } from '@/lib/paid-deal-payouts';

function formatCurrencyFromCents(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

function formatDateLabel(value: Date) {
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatDealWindow(start: Date, end: Date) {
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
}

function formatDiscountLabel(discountType: string, discountValue: number) {
  if (discountType === 'free_service') {
    return 'Free service';
  }

  if (discountType === 'amount_off') {
    return `$${discountValue} off`;
  }

  return `${discountValue}% off`;
}

function formatDeliveryLabel(deliveryType: string) {
  return deliveryType === 'purchase_link' ? 'Purchase link' : 'Code claim';
}

function getStatusMeta(input: {
  active: boolean;
  expiresAt: Date;
  maxRedemptions: number | null;
  redemptionCount: number;
  startsAt: Date;
}) {
  const now = new Date();

  if (!input.active) {
    return {
      label: 'Draft',
      tone: 'draft' as const,
    };
  }

  if (input.startsAt > now) {
    return {
      label: 'Scheduled',
      tone: 'scheduled' as const,
    };
  }

  if (
    input.maxRedemptions !== null &&
    input.redemptionCount >= input.maxRedemptions
  ) {
    return {
      label: 'Sold out',
      tone: 'ended' as const,
    };
  }

  if (input.expiresAt <= now) {
    return {
      label: 'Ended',
      tone: 'ended' as const,
    };
  }

  return {
    label: 'Live',
    tone: 'live' as const,
  };
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        email: true,
        name: true,
        businessType: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payoutStatus = getPaidDealPayoutStatus(business);
    const deals = await prisma.deal.findMany({
      where: { businessId: business.id },
      include: {
        purchases: {
          where: { status: 'paid' },
          select: {
            id: true,
            totalAmount: true,
          },
        },
        redemptions: {
          select: {
            id: true,
            transactionAmount: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 40,
    });

    const normalizedDeals = deals.map((deal) => {
      const revenueCents =
        deal.purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0) +
        deal.redemptions.reduce(
          (sum, redemption) => sum + Math.round((redemption.transactionAmount ?? 0) * 100),
          0,
        );
      const statusMeta = getStatusMeta({
        active: deal.active,
        expiresAt: deal.expiresAt,
        maxRedemptions: deal.maxRedemptions,
        redemptionCount: deal.redemptionCount,
        startsAt: deal.startsAt,
      });

      return {
        id: deal.id,
        title: deal.title,
        description: deal.description,
        discountLabel: formatDiscountLabel(deal.discountType, deal.discountValue),
        statusLabel: statusMeta.label,
        statusTone: statusMeta.tone,
        windowLabel: formatDealWindow(deal.startsAt, deal.expiresAt),
        deliveryLabel: formatDeliveryLabel(deal.deliveryType),
        purchasesCount: deal.purchases.length,
        redemptionsCount: deal.redemptions.length,
        revenueLabel: formatCurrencyFromCents(revenueCents),
        linkPath: `/d/${deal.id}`,
      };
    });

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      payoutReady: payoutStatus.ready,
      payoutSetupMessage: payoutStatus.ready ? null : payoutStatus.message,
      counts: {
        total: normalizedDeals.length,
        live: normalizedDeals.filter((deal) => deal.statusTone === 'live').length,
        scheduled: normalizedDeals.filter((deal) => deal.statusTone === 'scheduled').length,
        ended: normalizedDeals.filter((deal) => deal.statusTone === 'ended').length,
      },
      deals: normalizedDeals,
    });
  } catch (error) {
    console.error('GET /api/mobile/deals error:', error);
    return NextResponse.json({ error: 'Unable to load mobile deals' }, { status: 500 });
  }
}
