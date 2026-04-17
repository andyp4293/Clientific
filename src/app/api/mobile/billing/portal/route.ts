import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { requireMobileSession } from '@/lib/mobile-route';
import { normalizeBillingProvider } from '@/lib/billing-provider';

export async function POST(request: Request) {
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
        billingProvider: true,
        stripeCustomerId: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (normalizeBillingProvider(business.billingProvider) !== 'stripe') {
      return NextResponse.json(
        { error: 'This subscription is managed through the App Store.' },
        { status: 409 },
      );
    }

    let stripeCustomerId = business.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: business.email,
        name: business.name,
        metadata: { businessId: business.id },
      });
      stripeCustomerId = customer.id;
      await prisma.business.update({
        where: { id: business.id },
        data: { stripeCustomerId },
      });
    }

    const appUrl = getAppBaseUrlFromRequest(request.url);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('POST /api/mobile/billing/portal error:', error);
    return NextResponse.json({ error: 'Unable to open billing portal' }, { status: 500 });
  }
}
