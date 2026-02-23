import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, PRICING_PLANS } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

function getPlanFromPriceId(priceId: string): string | null {
  const entry = Object.entries(PRICING_PLANS).find(([, plan]) => plan.priceId === priceId);
  return entry ? entry[0].toLowerCase() : null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
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
  const businessId = session.metadata?.businessId;
  const plan = session.metadata?.plan;

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
      subscriptionPlan: plan || 'starter',
      subscriptionStatus: subscription.status,
      stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    },
  });
  // Create notification
  const trialEndMessage = subscription.trial_end 
    ? ` Your trial will end on ${new Date(subscription.trial_end * 1000).toLocaleDateString()}.`
    : '';
    
  await prisma.notification.create({
    data: {
      businessId,
      type: 'payment_success',
      title: 'Subscription Active',
      message: `Your ${plan} plan is now active.${trialEndMessage}`,
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
      stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      ...(newPlan && { subscriptionPlan: newPlan }),
    },
  });
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

  // Create notification
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
  // Save payment record
  await prisma.payment.create({
    data: {
      businessId: business.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      stripePaymentId: (invoice as any).payment_intent as string || invoice.id,
      stripeInvoiceId: invoice.id,
      description: invoice.lines.data[0]?.description || 'Subscription payment',
      receiptUrl: invoice.hosted_invoice_url || null,
    },
  });
  // Save invoice
  await prisma.invoice.create({
    data: {
      businessId: business.id,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      periodStart: new Date(invoice.lines.data[0]?.period?.start ? invoice.lines.data[0].period.start * 1000 : Date.now()),
      periodEnd: new Date(invoice.lines.data[0]?.period?.end ? invoice.lines.data[0].period.end * 1000 : Date.now()),
      invoicePdf: invoice.invoice_pdf || null,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
    },
  });
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

  // Create notification
  await prisma.notification.create({
    data: {
      businessId: business.id,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: 'Your recent payment failed. Please update your payment method to continue service.',
      link: '/dashboard/settings/billing',
    },
  });
}
