import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { getPaidDealPayoutStatus } from '@/lib/paid-deal-payouts';
import {
  isDealEndSameOrBeforeStart,
  isDealStartBeforeToday,
  parseDealDate,
} from '@/lib/deal-dates';
import { dealRequiresPayoutSetup } from '@/lib/paid-deal-payouts';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

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

function formatDateValue(value: Date) {
  return value.toISOString().slice(0, 10);
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

async function authorizeMobileDealsOwner(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }

  try {
    const session = await verifyMobileSessionToken(token);
    if (session.accountType === 'staff') {
      return {
        error: NextResponse.json(
          { error: 'Employee accounts can only access assigned appointments.' },
          { status: 403 },
        ),
      } as const;
    }

    return { session } as const;
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
}

function normalizeDealForMobile(deal: any) {
  const revenueCents =
    (deal.purchases ?? []).reduce((sum: number, purchase: any) => sum + purchase.totalAmount, 0) +
    (deal.redemptions ?? []).reduce(
      (sum: number, redemption: any) => sum + Math.round((redemption.transactionAmount ?? 0) * 100),
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
    active: deal.active,
    discountType: deal.discountType,
    discountValue: deal.discountValue,
    discountLabel: formatDiscountLabel(deal.discountType, deal.discountValue),
    deliveryType: deal.deliveryType,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    startsAt: deal.startsAt.toISOString(),
    startsAtValue: formatDateValue(deal.startsAt),
    expiresAt: deal.expiresAt.toISOString(),
    expiresAtValue: formatDateValue(deal.expiresAt),
    windowLabel: formatDealWindow(deal.startsAt, deal.expiresAt),
    deliveryLabel: formatDeliveryLabel(deal.deliveryType),
    serviceScope: deal.serviceScope,
    eligibleServices: (deal.eligibleServices ?? []).map((service: any) => ({
      id: service.id,
      name: service.name,
      price: service.price,
    })),
    newCustomersOnly: deal.newCustomersOnly,
    maxRedemptions: deal.maxRedemptions,
    redemptionCount: deal.redemptionCount,
    purchasesCount: (deal.purchases ?? []).length,
    redemptionsCount: (deal.redemptions ?? []).length,
    revenueLabel: formatCurrencyFromCents(revenueCents),
    linkPath: `/d/${deal.id}`,
  };
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  );
}

async function resolveEligibleServices(input: {
  businessId: string;
  discountType: string;
  serviceScope: string;
  eligibleServiceIds: string[];
}) {
  const selectedServiceIds = Array.from(new Set(input.eligibleServiceIds));

  if (input.serviceScope !== 'selected_services') {
    if (input.discountType === 'free_service') {
      return {
        error: NextResponse.json(
          { error: 'Free service deals must target exactly one service' },
          { status: 400 },
        ),
      } as const;
    }

    return { data: undefined } as const;
  }

  if (selectedServiceIds.length === 0) {
    return {
      error: NextResponse.json(
        { error: 'Choose at least one eligible service for this deal' },
        { status: 400 },
      ),
    } as const;
  }

  if (input.discountType === 'free_service' && selectedServiceIds.length !== 1) {
    return {
      error: NextResponse.json(
        { error: 'Free service deals must target exactly one service' },
        { status: 400 },
      ),
    } as const;
  }

  const validServices = await prisma.service.findMany({
    where: {
      businessId: input.businessId,
      id: { in: selectedServiceIds },
      active: true,
    },
    select: { id: true },
  });

  if (validServices.length !== selectedServiceIds.length) {
    return {
      error: NextResponse.json(
        { error: 'One or more selected services are invalid for this deal' },
        { status: 400 },
      ),
    } as const;
  }

  return {
    data: {
      connect: validServices.map((service) => ({ id: service.id })),
      set: validServices.map((service) => ({ id: service.id })),
    },
  } as const;
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
    if (session.accountType === 'staff') {
      return NextResponse.json(
        { error: 'Employee accounts can only access assigned appointments.' },
        { status: 403 },
      );
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
        eligibleServices: {
          select: {
            id: true,
            name: true,
            price: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 40,
    });

    const normalizedDeals = deals.map(normalizeDealForMobile);

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

export async function POST(request: Request) {
  const authorized = await authorizeMobileDealsOwner(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body?.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : null;
    const discountType =
      body?.discountType === 'amount_off'
        ? 'amount_off'
        : body?.discountType === 'free_service'
          ? 'free_service'
          : 'percent_off';
    const discountValue =
      discountType === 'free_service' ? 0 : Number(body?.discountValue);
    const startsAt = typeof body?.startsAt === 'string' ? body.startsAt : '';
    const expiresAt = typeof body?.expiresAt === 'string' ? body.expiresAt : '';
    const serviceScope =
      body?.serviceScope === 'selected_services' || discountType === 'free_service'
        ? 'selected_services'
        : 'all_services';
    const eligibleServiceIds = getStringArray(body?.eligibleServiceIds);
    const active = body?.active === false ? false : true;
    const maxRedemptions =
      body?.maxRedemptions === null || body?.maxRedemptions === undefined || body?.maxRedemptions === ''
        ? null
        : Number(body.maxRedemptions);

    if (!title || !startsAt || !expiresAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Deal title', value: title },
      { label: 'Deal description', value: description },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (discountType !== 'free_service' && !Number.isFinite(discountValue)) {
      return NextResponse.json({ error: 'discountValue required for this discount type' }, { status: 400 });
    }
    if (discountType === 'percent_off' && (discountValue <= 0 || discountValue > 100)) {
      return NextResponse.json({ error: 'Percent discount must be between 1% and 100%' }, { status: 400 });
    }
    if (discountType === 'amount_off' && discountValue <= 0) {
      return NextResponse.json({ error: 'Dollar discount must be greater than $0' }, { status: 400 });
    }
    if (maxRedemptions !== null && (!Number.isFinite(maxRedemptions) || maxRedemptions < 1)) {
      return NextResponse.json({ error: 'Max purchases must be at least 1' }, { status: 400 });
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

    const eligibleServices = await resolveEligibleServices({
      businessId: authorized.session.businessId,
      discountType,
      serviceScope,
      eligibleServiceIds,
    });
    if ('error' in eligibleServices) {
      return eligibleServices.error;
    }

    if (
      active &&
      dealRequiresPayoutSetup({
        deliveryType: 'purchase_link',
        discountType,
        discountValue,
      })
    ) {
      const business = await prisma.business.findUnique({
        where: { id: authorized.session.businessId },
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
        businessId: authorized.session.businessId,
        title,
        description,
        active,
        newCustomersOnly: Boolean(body?.newCustomersOnly),
        deliveryType: 'purchase_link',
        serviceScope,
        discountType,
        discountValue,
        ...(eligibleServices.data && { eligibleServices: { connect: eligibleServices.data.connect } }),
        startsAt: parsedStartsAt,
        expiresAt: parsedExpiresAt,
        maxRedemptions,
      },
      include: {
        eligibleServices: {
          select: { id: true, name: true, price: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json(
      {
        deal: normalizeDealForMobile({
          ...deal,
          purchases: [],
          redemptions: [],
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/mobile/deals error:', error);
    return NextResponse.json({ error: 'Unable to create mobile deal' }, { status: 500 });
  }
}
