import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import {
  isDealDateBeforeToday,
  isDealEndSameOrBeforeStart,
  isDealStartBeforeToday,
  parseDealDate,
} from '@/lib/deal-dates';
import {
  dealRequiresPayoutSetup,
  getPaidDealPayoutStatus,
} from '@/lib/paid-deal-payouts';
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

function getStatusMeta(input: {
  active: boolean;
  expiresAt: Date;
  maxRedemptions: number | null;
  redemptionCount: number;
  startsAt: Date;
}) {
  const now = new Date();

  if (!input.active) {
    return { label: 'Draft', tone: 'draft' as const };
  }

  if (input.startsAt > now) {
    return { label: 'Scheduled', tone: 'scheduled' as const };
  }

  if (input.maxRedemptions !== null && input.redemptionCount >= input.maxRedemptions) {
    return { label: 'Sold out', tone: 'ended' as const };
  }

  if (input.expiresAt <= now) {
    return { label: 'Ended', tone: 'ended' as const };
  }

  return { label: 'Live', tone: 'live' as const };
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
      (sum: number, redemption: any) =>
        sum + Math.round((redemption.transactionAmount ?? 0) * 100),
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
    deliveryLabel: deal.deliveryType === 'purchase_link' ? 'Purchase link' : 'Code claim',
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await authorizeMobileDealsOwner(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.deal.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
      },
      include: {
        eligibleServices: {
          select: { id: true, name: true, price: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const title = body?.title === undefined ? undefined : String(body.title).trim();
    const description =
      body?.description === undefined
        ? undefined
        : typeof body.description === 'string' && body.description.trim().length > 0
          ? body.description.trim()
          : null;
    const discountType =
      body?.discountType === undefined
        ? existing.discountType
        : body.discountType === 'amount_off'
          ? 'amount_off'
          : body.discountType === 'free_service'
            ? 'free_service'
            : 'percent_off';
    const discountValue =
      body?.discountValue === undefined
        ? existing.discountValue
        : discountType === 'free_service'
          ? 0
          : Number(body.discountValue);
    const serviceScope =
      body?.serviceScope === undefined
        ? discountType === 'free_service'
          ? 'selected_services'
          : existing.serviceScope
        : body.serviceScope === 'selected_services' || discountType === 'free_service'
          ? 'selected_services'
          : 'all_services';
    const requestedEligibleServiceIds =
      body?.eligibleServiceIds === undefined ? undefined : getStringArray(body.eligibleServiceIds);

    const blockedField = getBlockedFieldLabel([
      { label: 'Deal title', value: title },
      { label: 'Deal description', value: description },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (title !== undefined && !title) {
      return NextResponse.json({ error: 'Deal title is required' }, { status: 400 });
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

    let parsedStartsAt: Date | undefined;
    if (body?.startsAt !== undefined) {
      const parsed = parseDealDate(String(body.startsAt), false);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid deal dates' }, { status: 400 });
      }
      if (isDealStartBeforeToday(parsed)) {
        return NextResponse.json({ error: 'Start date cannot be earlier than today' }, { status: 400 });
      }
      parsedStartsAt = parsed;
    }

    let parsedExpiresAt: Date | undefined;
    if (body?.expiresAt !== undefined) {
      const parsed = parseDealDate(String(body.expiresAt), true);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid deal dates' }, { status: 400 });
      }
      if (isDealDateBeforeToday(parsed)) {
        return NextResponse.json({ error: 'End date cannot be earlier than today' }, { status: 400 });
      }
      parsedExpiresAt = parsed;
    }

    const nextStartsAt = parsedStartsAt ?? existing.startsAt;
    const nextExpiresAt = parsedExpiresAt ?? existing.expiresAt;
    if (isDealEndSameOrBeforeStart(nextStartsAt, nextExpiresAt)) {
      return NextResponse.json({ error: 'End date must be at least one day after start date' }, { status: 400 });
    }

    const maxRedemptions =
      body?.maxRedemptions === undefined
        ? undefined
        : body.maxRedemptions === null || body.maxRedemptions === ''
          ? null
          : Number(body.maxRedemptions);
    if (
      maxRedemptions !== undefined &&
      maxRedemptions !== null &&
      (!Number.isFinite(maxRedemptions) || maxRedemptions < 1)
    ) {
      return NextResponse.json({ error: 'Max purchases must be at least 1' }, { status: 400 });
    }

    let eligibleServicesData:
      | {
          set: { id: string }[];
        }
      | undefined;

    if (requestedEligibleServiceIds !== undefined) {
      const selectedServiceIds = Array.from(new Set(requestedEligibleServiceIds));

      if (serviceScope === 'selected_services') {
        if (selectedServiceIds.length === 0) {
          return NextResponse.json(
            { error: 'Choose at least one eligible service for this deal' },
            { status: 400 },
          );
        }
        if (discountType === 'free_service' && selectedServiceIds.length !== 1) {
          return NextResponse.json(
            { error: 'Free service deals must target exactly one service' },
            { status: 400 },
          );
        }

        const validServices = await prisma.service.findMany({
          where: {
            businessId: authorized.session.businessId,
            id: { in: selectedServiceIds },
            active: true,
          },
          select: { id: true },
        });

        if (validServices.length !== selectedServiceIds.length) {
          return NextResponse.json(
            { error: 'One or more selected services are invalid for this deal' },
            { status: 400 },
          );
        }

        eligibleServicesData = {
          set: validServices.map((service) => ({ id: service.id })),
        };
      } else {
        if (discountType === 'free_service') {
          return NextResponse.json(
            { error: 'Free service deals must target exactly one service' },
            { status: 400 },
          );
        }
        eligibleServicesData = { set: [] };
      }
    }

    const nextActive = body?.active === undefined ? existing.active : Boolean(body.active);
    const nextRequiresPayoutSetup = dealRequiresPayoutSetup({
      deliveryType: 'purchase_link',
      discountType,
      discountValue,
    });
    const existingRequiresPayoutSetup = dealRequiresPayoutSetup(existing);
    const isPublishingPaidPurchaseLink =
      nextRequiresPayoutSetup &&
      nextActive &&
      !(existing.active && existingRequiresPayoutSetup);

    if (isPublishingPaidPurchaseLink) {
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

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(body?.active !== undefined ? { active: nextActive } : {}),
        ...(body?.newCustomersOnly !== undefined
          ? { newCustomersOnly: Boolean(body.newCustomersOnly) }
          : {}),
        ...(body?.serviceScope !== undefined || discountType === 'free_service' ? { serviceScope } : {}),
        ...(body?.discountType !== undefined ? { discountType } : {}),
        ...(body?.discountValue !== undefined || discountType === 'free_service' ? { discountValue } : {}),
        ...(eligibleServicesData ? { eligibleServices: eligibleServicesData } : {}),
        ...(parsedStartsAt !== undefined ? { startsAt: parsedStartsAt } : {}),
        ...(parsedExpiresAt !== undefined ? { expiresAt: parsedExpiresAt } : {}),
        ...(maxRedemptions !== undefined ? { maxRedemptions } : {}),
      },
      include: {
        eligibleServices: {
          select: { id: true, name: true, price: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return NextResponse.json({
      deal: normalizeDealForMobile({
        ...deal,
        purchases: [],
        redemptions: [],
      }),
    });
  } catch (error) {
    console.error('PATCH /api/mobile/deals/[id] error:', error);
    return NextResponse.json({ error: 'Unable to update mobile deal' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await authorizeMobileDealsOwner(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const { id } = await params;
    const existing = await prisma.deal.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    await prisma.deal.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mobile/deals/[id] error:', error);
    return NextResponse.json({ error: 'Unable to delete mobile deal' }, { status: 500 });
  }
}
