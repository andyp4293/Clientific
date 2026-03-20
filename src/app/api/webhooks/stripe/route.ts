import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { revalidateTag } from 'next/cache';
import { stripe, PRICING_PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import {
  createDealPurchaseFromPaymentIntent,
  finalizeDealPurchaseFromCheckoutSession,
  finalizeDealPurchaseFromPaymentIntent,
} from '@/lib/deal-purchases';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { REFERRAL_COMMISSION_PERCENT } from '@/lib/referral-config';
import {
  canAutoTransferReferralPayouts,
  recordReferralCommission,
  settlePendingReferralCommissions,
} from '@/lib/referral-payouts';
import {
  getPublicPlanLabel,
  getPublicPlanSlug,
  normalizeSubscriptionPlan,
} from '@/lib/plan-utils';
import { sanitizeStripeEnvValue } from '@/lib/stripe-env';

function getPlanFromPriceId(priceId: string): string | null {
  const entry = Object.entries(PRICING_PLANS).find(
    ([, plan]) => plan.priceId === priceId || plan.yearlyPriceId === priceId
  );
  return entry ? getPublicPlanSlug(entry[0].toLowerCase()) : null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      sanitizeStripeEnvValue(process.env.STRIPE_WEBHOOK_SECRET)
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.dealPurchaseId) {
    await finalizeDealPurchaseFromCheckoutSession(
      session,
      getConfiguredAppBaseUrl()
    );
    return;
  }

  const businessId = session.metadata?.businessId;
  const plan = normalizeSubscriptionPlan(session.metadata?.plan);

  if (!businessId) return;

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  await prisma.business.update({
    where: { id: businessId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      subscriptionPlan: plan,
      subscriptionStatus: subscription.status,
      stripeCurrentPeriodEnd: new Date(
        (subscription as any).current_period_end * 1000
      ),
    },
  });

  revalidateTag(`subscription-status-${businessId}`, {});
  revalidateTag(`dashboard-stats-${businessId}`, {});
  revalidateTag(`business-${businessId}`, {});

  const trialEndMessage = subscription.trial_end
    ? ` Your trial will end on ${new Date(
        subscription.trial_end * 1000
      ).toLocaleDateString()}.`
    : '';

  await prisma.notification.create({
    data: {
      businessId,
      type: 'payment_success',
      title: 'Subscription Active',
      message: `Your ${getPublicPlanLabel(plan)} plan is now active.${trialEndMessage}`,
      link: '/dashboard/settings/billing',
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const business = await prisma.business.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!business) return;

  const newPriceId = subscription.items.data[0].price.id;
  const newPlan = getPlanFromPriceId(newPriceId);

  await prisma.business.update({
    where: { id: business.id },
    data: {
      subscriptionStatus: subscription.status,
      stripePriceId: newPriceId,
      stripeCurrentPeriodEnd: new Date(
        (subscription as any).current_period_end * 1000
      ),
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      ...(newPlan && { subscriptionPlan: newPlan }),
    },
  });

  revalidateTag(`subscription-status-${business.id}`, {});
  revalidateTag(`dashboard-stats-${business.id}`, {});
  revalidateTag(`business-${business.id}`, {});
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const business = await prisma.business.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!business) return;

  await prisma.business.update({
    where: { id: business.id },
    data: {
      subscriptionStatus: 'canceled',
    },
  });

  revalidateTag(`subscription-status-${business.id}`, {});
  revalidateTag(`dashboard-stats-${business.id}`, {});
  revalidateTag(`business-${business.id}`, {});

  await prisma.notification.create({
    data: {
      businessId: business.id,
      type: 'payment_failed',
      title: 'Subscription Canceled',
      message: 'Your subscription has been canceled. You can reactivate it anytime.',
      link: '/pricing',
    },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const business = await prisma.business.findUnique({
    where: { stripeCustomerId: invoice.customer as string },
  });

  if (!business) return;

  const paymentIntentId = (invoice as any).payment_intent as string | null;

  if (invoice.amount_paid > 0 && paymentIntentId) {
    await prisma.payment.upsert({
      where: { stripePaymentId: paymentIntentId },
      create: {
        businessId: business.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        stripePaymentId: paymentIntentId,
        stripeInvoiceId: invoice.id,
        description: invoice.lines.data[0]?.description || 'Subscription payment',
        receiptUrl: invoice.hosted_invoice_url || null,
      },
      update: {},
    });
  }

  const paidAt = invoice.status_transitions.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date();

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      businessId: business.id,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      periodStart: new Date(
        invoice.lines.data[0]?.period?.start
          ? invoice.lines.data[0].period.start * 1000
          : Date.now()
      ),
      periodEnd: new Date(
        invoice.lines.data[0]?.period?.end
          ? invoice.lines.data[0].period.end * 1000
          : Date.now()
      ),
      invoicePdf: invoice.invoice_pdf || null,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      paidAt,
    },
    update: {},
  });

  if (invoice.amount_paid > 0) {
    const referral = await prisma.referral.findFirst({
      where: {
        refereeId: business.id,
        status: { in: ['pending', 'active', 'credited'] },
      },
      include: {
        referrer: {
          select: {
            id: true,
            stripeConnectAccountId: true,
            stripeConnectChargesEnabled: true,
            stripeConnectPayoutsEnabled: true,
            stripeConnectDetailsSubmitted: true,
          },
        },
      },
    });

    if (referral) {
      const commissionCents = Math.round(
        invoice.amount_paid * REFERRAL_COMMISSION_PERCENT
      );

      try {
        const result = await recordReferralCommission({
          referralId: referral.id,
          referrerId: referral.referrerId,
          stripeInvoiceId: invoice.id,
          commissionCents,
        });

        if (result.created) {
          console.log(
            `Referral commission recorded: $${(result.amountCents / 100).toFixed(2)} for business ${referral.referrerId}`
          );
        }

        if (
          canAutoTransferReferralPayouts(referral.referrer) &&
          referral.referrer.stripeConnectAccountId
        ) {
          const settlement = await settlePendingReferralCommissions({
            businessId: referral.referrerId,
            connectAccountId: referral.referrer.stripeConnectAccountId,
          });

          if (settlement.transferredCount > 0) {
            console.log(
              `Referral commissions moved into Stripe payouts: $${(
                settlement.transferredAmount / 100
              ).toFixed(2)} for business ${referral.referrerId}`
            );
          }
        }
      } catch (error) {
        console.warn('Referral commission handling failed:', error);
      }
    }

    const affSignup = await prisma.affiliateSignup.findFirst({
      where: { businessId: business.id, status: 'pending' },
    });

    if (affSignup) {
      const affCommissionDollars =
        Math.round(invoice.amount_paid * REFERRAL_COMMISSION_PERCENT) / 100;

      try {
        await prisma.affiliateSignup.update({
          where: { id: affSignup.id },
          data: {
            status: 'earned',
            earnedAt: new Date(),
            earnAmount: affCommissionDollars,
          },
        });
        console.log(
          `Affiliate signup earned: $${affCommissionDollars.toFixed(2)} for ${affSignup.affiliateId}`
        );
      } catch (error) {
        console.warn('Affiliate signup update failed:', error);
      }
    }
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(
    '[deal-webhook] payment_intent.succeeded',
    paymentIntent.id,
    'kind:',
    paymentIntent.metadata?.kind
  );

  if (paymentIntent.metadata?.kind !== 'deal_purchase') return;

  if (paymentIntent.metadata?.dealPurchaseId) {
    console.log(
      '[deal-webhook] finalizing purchase',
      paymentIntent.metadata.dealPurchaseId
    );
    await finalizeDealPurchaseFromPaymentIntent(
      paymentIntent,
      getConfiguredAppBaseUrl()
    );
    console.log(
      '[deal-webhook] finalized purchase',
      paymentIntent.metadata.dealPurchaseId
    );
    return;
  }

  if (paymentIntent.metadata?.purchaseToken) {
    console.log(
      '[deal-webhook] legacy create for purchaseToken',
      paymentIntent.metadata.purchaseToken
    );
    await createDealPurchaseFromPaymentIntent(
      paymentIntent,
      getConfiguredAppBaseUrl()
    );
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const business = await prisma.business.findUnique({
    where: { stripeCustomerId: invoice.customer as string },
  });

  if (!business) return;

  await prisma.business.update({
    where: { id: business.id },
    data: {
      subscriptionStatus: 'past_due',
    },
  });

  revalidateTag(`subscription-status-${business.id}`, {});

  await prisma.notification.create({
    data: {
      businessId: business.id,
      type: 'payment_failed',
      title: 'Payment Failed',
      message:
        'Your recent payment failed. Please update your payment method to continue service.',
      link: '/dashboard/settings/billing',
    },
  });
}
