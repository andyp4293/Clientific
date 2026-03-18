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
import { createPendingDealPurchase, finalizeDealPurchaseFromPaymentIntent } from '@/lib/deal-purchases';
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

    // Free deal: create + finalize immediately (no payment required)
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

    // Paid deal: verify Connect account is ready BEFORE creating any DB records
    const connectAccount = await ensureBusinessConnectAccount(
      {
        id: deal.business.id,
        email: deal.business.email,
        name: deal.business.name,
        stripeConnectAccountId: deal.business.stripeConnectAccountId,
      },
      appUrl
    );

    if (!(connectAccount.charges_enabled && connectAccount.payouts_enabled && connectAccount.details_submitted)) {
      return NextResponse.json(
        { error: 'This business is not ready to accept purchased deals yet' },
        { status: 409 }
      );
    }

    // Connect account is ready — now create the purchase record and payment intent
    const purchase = await createPendingDealPurchase({
      deal,
      customerName,
      customerPhone: formatPhoneNumber(customerPhone),
      totals,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totals.totalAmount,
      currency: 'usd',
      application_fee_amount: purchase.applicationFeeAmount,
      transfer_data: {
        destination: connectAccount.id,
      },
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind: 'deal_purchase',
        dealPurchaseId: purchase.id,
        dealId: deal.id,
        businessId: deal.business.id,
      },
    });

    await prisma.dealPurchase.update({
      where: { id: purchase.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      purchaseId: purchase.id,
      purchaseToken: purchase.token,
    });
  } catch (error: any) {
    if (error instanceof DealPurchasePricingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Surface Stripe errors with their actual message to aid debugging
    if (error?.type?.startsWith('Stripe') || error?.raw?.type) {
      const stripeMessage = error?.message ?? 'Stripe error';
      console.error('POST /api/public/deals/[id]/payment-intent Stripe error:', error);
      return NextResponse.json({ error: stripeMessage }, { status: 502 });
    }

    console.error('POST /api/public/deals/[id]/payment-intent error:', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
