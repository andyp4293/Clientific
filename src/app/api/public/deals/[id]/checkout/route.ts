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
import { createPendingDealPurchase, finalizeDealPurchaseFromCheckoutSession } from '@/lib/deal-purchases';
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
      ? body.selectedServiceIds.filter((value: unknown): value is string => typeof value === 'string')
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
          select: {
            id: true,
            name: true,
            price: true,
            active: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            businessEmail: true,
            publicId: true,
            slug: true,
            stripeConnectAccountId: true,
            services: {
              where: { active: true },
              select: {
                id: true,
                name: true,
                price: true,
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
    const purchase = await createPendingDealPurchase({
      deal,
      customerName,
      customerPhone: formatPhoneNumber(customerPhone),
      totals,
    });

    const appUrl = getAppBaseUrlFromRequest(req.url);

    if (totals.totalAmount === 0) {
      const finalized = await finalizeDealPurchaseFromCheckoutSession(
        {
          id: `free_${purchase.id}`,
          metadata: {
            dealPurchaseId: purchase.id,
          },
          customer_details: {
            email: purchase.customer?.email ?? null,
          },
          payment_intent: null,
        } as any,
        appUrl
      );

      return NextResponse.json({
        url: `${appUrl}/deal-purchases/${purchase.token}`,
        immediate: true,
        purchaseId: finalized?.id ?? purchase.id,
      });
    }

    const connectAccount = await ensureBusinessConnectAccount(
      {
        id: deal.business.id,
        email: deal.business.email,
        name: deal.business.name,
        phone: deal.business.phone,
        businessEmail: deal.business.businessEmail,
        publicId: deal.business.publicId,
        slug: deal.business.slug,
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

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: totals.totalAmount,
            product_data: {
              name: `${deal.title} - ${deal.business.name}`,
              description: resolvedServices.map((service) => service.name).join(', ').slice(0, 500),
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: purchase.applicationFeeAmount,
        transfer_data: {
          destination: connectAccount.id,
        },
      },
      success_url: `${appUrl}/deal-purchases/${purchase.token}?checkout=success`,
      cancel_url: `${appUrl}/d/${deal.id}?checkout=canceled`,
      metadata: {
        kind: 'deal_purchase',
        dealPurchaseId: purchase.id,
        dealId: deal.id,
        businessId: deal.business.id,
      },
    });

    await prisma.dealPurchase.update({
      where: { id: purchase.id },
      data: {
        stripeCheckoutSessionId: checkoutSession.id,
      },
    });

    return NextResponse.json({ url: checkoutSession.url, purchaseId: purchase.id });
  } catch (error: any) {
    if (error instanceof DealPurchasePricingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('POST /api/public/deals/[id]/checkout error:', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
