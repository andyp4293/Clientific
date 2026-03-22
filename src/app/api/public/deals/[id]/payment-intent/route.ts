import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { dealRequiresPayoutSetup } from '@/lib/paid-deal-payouts';
import {
  calculateDealPurchaseTotals,
  DealPurchasePricingError,
  getSelectableServicesForDeal,
  resolveSelectedServicesForDeal,
} from '@/lib/deal-purchase-pricing';
import {
  createPendingDealPurchase,
  finalizeDealPurchaseFromPaymentIntent,
} from '@/lib/deal-purchases';
import {
  ensureBusinessConnectAccount,
  isConnectAccountReady,
} from '@/lib/stripe-connect';
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
    const customerEmail =
      typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '';
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
            ownerPhone: true,
            phone: true,
            businessEmail: true,
            publicId: true,
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
        customerEmail: customerEmail || null,
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

    let connectAccountId: string | null = null;

    if (dealRequiresPayoutSetup(deal)) {
      const connectAccount = await ensureBusinessConnectAccount(
        {
          id: deal.business.id,
          email: deal.business.email,
          name: deal.business.name,
          ownerPhone: deal.business.ownerPhone,
          phone: deal.business.phone,
          businessEmail: deal.business.businessEmail,
          publicId: deal.business.publicId,
          slug: deal.business.slug,
          stripeConnectAccountId: deal.business.stripeConnectAccountId,
        },
        appUrl
      );

      if (!isConnectAccountReady(connectAccount)) {
        return NextResponse.json(
          {
            error:
              'This business is still finishing payout setup, so this paid deal is not available yet.',
          },
          { status: 409 }
        );
      }

      connectAccountId = connectAccount.id;
    }

    // Paid deal: create a pending purchase row first so the receipt page can
    // find it immediately after payment. The webhook (payment_intent.succeeded)
    // will finalize it (set status=paid, assign redemptionCode, send SMS).
    const purchase = await createPendingDealPurchase({
      deal,
      customerName,
      customerEmail: customerEmail || null,
      customerPhone: formatPhoneNumber(customerPhone),
      totals,
    });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: totals.totalAmount,
        currency: 'usd',
        application_fee_amount: purchase.applicationFeeAmount,
        automatic_payment_methods: { enabled: true },
        transfer_data: {
          destination: connectAccountId!,
        },
        metadata: {
          kind: 'deal_purchase',
          dealPurchaseId: purchase.id,
          dealId: deal.id,
          businessId: deal.business.id,
          customerName,
          customerEmail: customerEmail || '',
          customerPhone: formatPhoneNumber(customerPhone),
          selectedServiceIds: JSON.stringify(selectedServiceIds),
          subtotalAmount: String(totals.subtotalAmount),
          discountAmount: String(totals.discountAmount),
          totalAmount: String(totals.totalAmount),
          expiresAt: deal.expiresAt.toISOString(),
        },
      });
    } catch (stripeError) {
      // Clean up the pending record so it doesn't linger in the DB
      await prisma.dealPurchase.delete({ where: { id: purchase.id } }).catch(() => {});
      throw stripeError;
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      purchaseToken: purchase.token,
    });
  } catch (error: any) {
    if (error instanceof DealPurchasePricingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Stripe errors have type/code/statusCode properties — surface them clearly
    const stripeType: string | undefined = error?.type;
    const stripeCode: string | undefined = error?.code;
    const stripeStatus: number | undefined = error?.statusCode;
    // Log each field on its own line so Vercel's truncation doesn't hide the error
    console.error('[PI:type]', stripeType ?? '(none)');
    console.error('[PI:code]', stripeCode ?? '(none)');
    console.error('[PI:status]', stripeStatus ?? '(none)');
    console.error('[PI:msg]', error?.message?.slice(0, 120) ?? '(none)');
    console.error('[PI:stack]', error?.stack?.slice(0, 200) ?? '(none)');

    // User-facing Stripe errors (invalid request, authentication) → 400
    if (stripeType && ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripeCardError'].includes(stripeType)) {
      return NextResponse.json({ error: error.message || 'Payment setup failed' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
