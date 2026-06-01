import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { stripe, PRICING_PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { getPricingPlanKey, normalizeSubscriptionPlan } from '@/lib/plan-utils';
import { getSessionBusinessId } from '@/lib/session-business';
import { normalizeBillingProvider } from '@/lib/billing-provider';
import {
  buildAutomaticIdempotencyKey,
  buildIdempotencyFingerprint,
  getRequestIdempotencyKey,
  runIdempotentJson,
} from '@/lib/idempotency';

function createPriceConfigurationError(message: string) {
  return Object.assign(new Error(message), {
    code: 'PRICE_CONFIGURATION_ERROR',
  });
}

function getCheckoutTrialDays(business: {
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | string | null;
}) {
  if (business.stripeSubscriptionId) {
    return undefined;
  }

  const status = business.subscriptionStatus?.toLowerCase() ?? '';
  const hasTrialStatus = status === 'trialing' || status === 'trial';

  if (!hasTrialStatus) {
    return undefined;
  }

  if (!business.trialEndsAt) {
    return 14;
  }

  const remainingMs = new Date(business.trialEndsAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    return undefined;
  }

  return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
}

async function validateCheckoutPrice({
  priceId,
  expectedAmount,
  expectedInterval,
}: {
  priceId: string;
  expectedAmount: number;
  expectedInterval: 'month' | 'year';
}) {
  const price = await stripe.prices.retrieve(priceId);

  if (!price.active) {
    throw createPriceConfigurationError(`Configured Stripe price is inactive: ${priceId}`);
  }

  if (price.currency?.toLowerCase() !== 'usd') {
    throw createPriceConfigurationError(`Configured Stripe price must use USD: ${priceId}`);
  }

  if (price.recurring?.interval !== expectedInterval) {
    throw createPriceConfigurationError(
      `Configured Stripe price interval ${price.recurring?.interval ?? 'missing'} does not match ${expectedInterval}: ${priceId}`
    );
  }

  if (price.unit_amount !== expectedAmount) {
    throw createPriceConfigurationError(
      `Configured Stripe price amount ${price.unit_amount} does not match expected ${expectedAmount}: ${priceId}`
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const businessId = getSessionBusinessId(session);
    const sessionEmail = session?.user?.email?.trim() || null;

    if (!businessId && !sessionEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan, billingPeriod } = await req.json();

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan is required' },
        { status: 400 }
      );
    }

    const planKey = getPricingPlanKey(plan);
    const normalizedPlan = normalizeSubscriptionPlan(plan);
    const planConfig = planKey ? PRICING_PLANS[planKey] : null;

    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const useYearlyPrice =
      billingPeriod === 'yearly' &&
      planConfig.supportsYearly &&
      Boolean(planConfig.yearlyPriceId);
    const priceId = useYearlyPrice ? planConfig.yearlyPriceId : planConfig.priceId;
    const expectedAmount = (useYearlyPrice ? planConfig.yearlyPrice : planConfig.price) * 100;
    const expectedInterval = useYearlyPrice ? 'year' : 'month';

    const business = businessId
      ? await prisma.business.findUnique({
          where: { id: businessId },
        })
      : await prisma.business.findUnique({
          where: { email: sessionEmail as string },
        });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (normalizeBillingProvider(business.billingProvider) !== 'stripe') {
      return NextResponse.json(
        { error: 'This subscription is managed through the App Store.' },
        { status: 409 },
      );
    }

    const checkoutFingerprint = [
      'subscription-checkout',
      business.id,
      normalizedPlan,
      useYearlyPrice ? 'yearly' : 'monthly',
      priceId,
    ];
    const idempotencyKey =
      getRequestIdempotencyKey(req) ??
      buildAutomaticIdempotencyKey('subscription-checkout', checkoutFingerprint);

    return await runIdempotentJson({
      scope: 'subscription-checkout',
      ownerId: business.id,
      key: idempotencyKey,
      requestHash: buildIdempotencyFingerprint(checkoutFingerprint),
      ttlMs: 30 * 60 * 1000,
      handler: async ({ idempotencyKey: stripeIdempotencyKey }) => {
        // Create or get Stripe customer
        let customerId = business.stripeCustomerId;

        if (!customerId) {
          const customer = await stripe.customers.create({
            email: business.email,
            name: business.name,
            metadata: {
              businessId: business.id,
            },
          });
          customerId = customer.id;

          // Save customer ID
          await prisma.business.update({
            where: { id: business.id },
            data: { stripeCustomerId: customerId },
          });
        }

        const checkoutTrialDays = getCheckoutTrialDays(business);
        await validateCheckoutPrice({ priceId, expectedAmount, expectedInterval });

        // Derive base URL — prefer env var, fall back to the request origin
        const appUrl = getAppBaseUrlFromRequest(req.url);

        // Create Checkout Session
        const checkoutSession = await stripe.checkout.sessions.create(
          {
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
              {
                price: priceId,
                quantity: 1,
              },
            ],
            subscription_data: {
              ...(checkoutTrialDays ? { trial_period_days: checkoutTrialDays } : {}),
              metadata: {
                businessId: business.id,
                plan: normalizedPlan,
              },
            },
            success_url: `${appUrl}/dashboard?checkout=success`,
            cancel_url: `${appUrl}/pricing?checkout=canceled`,
            metadata: {
              businessId: business.id,
              plan: normalizedPlan,
            },
          },
          { idempotencyKey: stripeIdempotencyKey }
        );

        return { body: { url: checkoutSession.url } };
      },
    });
  } catch (error: any) {
    console.error('Checkout error:', error);

    const message = typeof error?.message === 'string' ? error.message : '';
    if (
      message.includes('No such price') ||
      error?.code === 'PRICE_CONFIGURATION_ERROR'
    ) {
      return NextResponse.json(
        { error: 'Checkout is temporarily unavailable. Please try again in a moment.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
