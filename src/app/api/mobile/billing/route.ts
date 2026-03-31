import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getSubscriptionInfo } from '@/lib/subscription';
import { PRICING_PLANS } from '@/lib/pricing-plans';
import { getPricingPlanKey } from '@/lib/plan-utils';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { requireMobileSession } from '@/lib/mobile-route';

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatStripeDate(timestamp: number | null | undefined) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPlanPrice(price: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatSubscriptionStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase() || 'active';
  const labels: Record<string, string> = {
    active: 'Active',
    trialing: 'Free Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
  };

  return labels[normalized] ?? 'Active';
}

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: authorized.session.businessId },
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
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getSubscriptionInfo(business.id);
    if (!subscription) {
      return NextResponse.json({ error: 'Unable to load billing' }, { status: 404 });
    }

    const planKey = getPricingPlanKey(subscription.subscriptionPlan);
    const plan = planKey ? PRICING_PLANS[planKey] : PRICING_PLANS.STARTER;

    let paymentMethod = null;

    if (business.stripeSubscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          business.stripeSubscriptionId,
          { expand: ['default_payment_method', 'customer'] },
        );

        const defaultPaymentMethod = stripeSubscription.default_payment_method as {
          card?: {
            brand: string;
            last4: string;
            exp_month: number;
            exp_year: number;
          };
        } | null;

        if (defaultPaymentMethod?.card) {
          paymentMethod = {
            brand: defaultPaymentMethod.card.brand,
            last4: defaultPaymentMethod.card.last4,
            expMonth: defaultPaymentMethod.card.exp_month,
            expYear: defaultPaymentMethod.card.exp_year,
            label: `${defaultPaymentMethod.card.brand.toUpperCase()} ending in ${defaultPaymentMethod.card.last4}`,
          };
        }
      } catch (error) {
        console.error('GET /api/mobile/billing subscription expansion error:', error);
      }
    }

    let invoices: Array<{
      id: string;
      amountLabel: string;
      createdLabel: string | null;
      status: string;
      statusLabel: string;
      description: string | null;
      hostedInvoiceUrl: string | null;
      invoicePdf: string | null;
    }> = [];

    if (business.stripeCustomerId) {
      const invoiceList = await stripe.invoices.list({
        customer: business.stripeCustomerId,
        limit: 10,
      });

      invoices = invoiceList.data.map((invoice) => ({
        id: invoice.id,
        amountLabel: formatCurrency(invoice.amount_paid || invoice.amount_due || 0, invoice.currency),
        createdLabel: formatStripeDate(invoice.created),
        status: invoice.status ?? 'draft',
        statusLabel: formatSubscriptionStatus(invoice.status),
        description: invoice.lines?.data?.[0]?.description ?? null,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
      }));
    }

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      currentPlanName: plan.name,
      currentPlanPriceLabel: `${formatPlanPrice(plan.price)}/month`,
      planSummary: plan.summary,
      subscriptionStatus: subscription.subscriptionStatus,
      subscriptionStatusLabel: formatSubscriptionStatus(subscription.subscriptionStatus),
      trialDaysRemaining: subscription.trialDaysRemaining,
      trialEndsAtLabel: subscription.trialEndsAt
        ? new Date(subscription.trialEndsAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : null,
      nextBillingDateLabel: subscription.stripeCurrentPeriodEnd
        ? new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : null,
      paymentMethod,
      invoices,
    });
  } catch (error) {
    console.error('GET /api/mobile/billing error:', error);
    return NextResponse.json({ error: 'Unable to load billing' }, { status: 500 });
  }
}
