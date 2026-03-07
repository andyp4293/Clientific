import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business
    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    let stripeCustomerId = business.stripeCustomerId;

    // Create a Stripe customer on-the-fly if none exists (trial users)
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

    // Derive base URL — prefer env var, fall back to the request origin
    // so the return_url is always a valid absolute URL (avoids "undefined/..." in prod)
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).trim().replace(/\/$/, '');

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Portal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
