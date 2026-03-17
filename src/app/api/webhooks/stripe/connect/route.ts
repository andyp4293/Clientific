import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { syncBusinessConnectAccount } from '@/lib/stripe-connect';

function getWebhookSecret() {
  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch (error: any) {
    console.error('Stripe Connect webhook signature verification failed:', error?.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const businessId = account.metadata?.businessId;
        if (businessId) {
          await syncBusinessConnectAccount(businessId, account);
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('POST /api/webhooks/stripe/connect error:', error);
    return NextResponse.json({ error: 'Failed to process Stripe Connect webhook' }, { status: 500 });
  }
}
