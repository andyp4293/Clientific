import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import {
  calculateDealPurchaseTotals,
  DealPurchasePricingError,
  getSelectableServicesForDeal,
  resolveSelectedServicesForDeal,
} from '@/lib/deal-purchase-pricing';
import {
  createDealPurchaseFromPaymentIntent,
  createPendingDealPurchase,
  finalizeDealPurchaseFromPaymentIntent,
} from '@/lib/deal-purchases';
import { ensureBusinessConnectAccount } from '@/lib/stripe-connect';
import { formatPhoneNumber, isValidPhoneNumber } from '@/lib/twilio';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const customerName =
      typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const customerPhone =
      typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
    const selectedServiceIds = Array.isArray(body.selectedServiceIds)
      ? body.selectedServiceIds.filter((v: unknown): v is string => typeof v === 'string')
      : [];

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    if (!isValidPhoneNumber(customerPhone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        eligibleServices: {
          where: { active: true },
          select: { id: true, name: true, price: true, active: true },
        },
        business: {
          select: {
            id: true,
            name: true,
            email: true,
            slug: true,
            stripeConnectAccountId: true,
            services: {
              where: { active: true },
              select: { id: true, name: true, price: true, active: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!deal || !deal.active) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (deal.deliveryType !== 'purchase_link') {
      return NextResponse.json(
        { error: 'This deal must be claimed with a redemption code instead of purchased' },
        { status: 400 }
      );
    }

    const now = new Date();
    if (deal.startsAt > now || deal.expiresAt <= now) {
      return NextResponse.json({ error: 'Deal is not currently active' }, { status: 400 });
    }

    if (deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions) {
      return NextResponse.json({ error: 'Deal is sold out' }, { status: 400 });
    }

    const selectableServices = getSelectableServicesForDeal(
      deal,
      deal.eligibleServices,
      deal.business.services
    );
    const resolvedServices = resolveSelectedServicesForDeal(
      deal,
      selectableServices,
      selectedServiceIds
    );
    const totals = calculateDealPurchaseTotals(deal, resolvedServices);
    const appUrl = getAppBaseUrlFromRequest(req.url);

    // Free deal: create + finalize immediately (no payment required, no pending record)
    if (totals.totalAmount === 0) {
      const purchase = await createPendingDealPurchase({
        deal,
        customerName,
        customerPhone: formatPhoneNumber(customerPhone),
        totals,
      });
      const finalized = await finalizeDealPurchaseFromPaymentIntent(
        {
          id: `free_${purchase.id}`,
          metadata: { dealPurchaseId: purchase.id },
        } as any,
        appUrl
      );

      return NextResponse.json({
        url: `${appUrl}/deal-purchases/${purchase.token}`,
        immediate: true,
        purchaseId: finalized?.id ?? purchase.id,
      });
    }

    // Paid deal: verify Connect account is ready — no DB writes happen until payment succeeds
    let connectAccount;
    try {
      connectAccount = await ensureBusinessConnectAccount(
        {
          id: deal.business.id,
          email: deal.business.email,
          name: deal.business.name,
          stripeConnectAccountId: deal.business.stripeConnectAccountId,
        },
        appUrl
      );
    } catch (err: any) {
      console.error('POST /api/public/deals/[id]/payment-intent Connect error:', err);
      return NextResponse.json(
        { error: 'This business is not ready to accept purchased deals yet' },
        { status: 409 }
      );
    }

    if (!(connectAccount.charges_enabled && connectAccount.payouts_enabled && connectAccount.details_submitted)) {
      return NextResponse.json(
        { error: 'This business is not ready to accept purchased deals yet' },
        { status: 409 }
      );
    }

    // Generate a receipt token in-memory — the DealPurchase row is created only
    // when the Stripe webhook fires (payment_intent.succeeded).
    const purchaseToken = randomBytes(18).toString('base64url');
    const applicationFeeAmount = Math.round(
      totals.totalAmount * (deal.platformFeePercent / 100)
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totals.totalAmount,
      currency: 'usd',
      application_fee_amount: applicationFeeAmount,
      transfer_data: { destination: connectAccount.id },
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: 'deal_purchase',
        purchaseToken,
        dealId: deal.id,
        businessId: deal.business.id,
        customerName,
        customerPhone: formatPhoneNumber(customerPhone),
        selectedServiceIds: JSON.stringify(selectedServiceIds),
        subtotalAmount: String(totals.subtotalAmount),
        discountAmount: String(totals.discountAmount),
        totalAmount: String(totals.totalAmount),
        applicationFeeAmount: String(applicationFeeAmount),
        expiresAt: deal.expiresAt.toISOString(),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      purchaseToken,
    });
  } catch (error: any) {
    if (error instanceof DealPurchasePricingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('POST /api/public/deals/[id]/payment-intent error:', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
