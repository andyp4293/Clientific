import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { stripe, PRICING_PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { getPricingPlanKey, normalizeSubscriptionPlan } from '@/lib/plan-utils';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
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

    // Get business
    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

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

    // Only give trial to first-time subscribers; returning customers pay immediately
    // to prevent exploitation of multiple free trials.
    const isFirstTime = !business.stripeSubscriptionId;

    // Derive base URL — prefer env var, fall back to the request origin
    const appUrl = getAppBaseUrlFromRequest(req.url);

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
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
        ...(isFirstTime && { trial_period_days: 14 }),
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
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error('Checkout error:', error);

    const message = typeof error?.message === 'string' ? error.message : '';
    if (message.includes('No such price')) {
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
