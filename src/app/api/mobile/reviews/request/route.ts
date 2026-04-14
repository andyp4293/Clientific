import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { sendReviewSurveyRequestForCustomer } from '@/lib/review-requests';

export async function POST(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const body = (await request.json()) as { customerId?: unknown };
    const customerId = typeof body.customerId === 'string' ? body.customerId : '';

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const [customer, business] = await Promise.all([
      prisma.customer.findFirst({
        where: {
          id: customerId,
          businessId: authorized.session.businessId,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          smsConsent: true,
          smsOptedOut: true,
        },
      }),
      prisma.business.findUnique({
        where: { id: authorized.session.businessId },
        select: {
          id: true,
          name: true,
          slug: true,
          publicId: true,
          googleReviewUrl: true,
          yelpUrl: true,
        },
      }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    if (!customer.phone) {
      return NextResponse.json({ error: 'Customer has no phone number' }, { status: 400 });
    }
    if (!customer.smsConsent || customer.smsOptedOut) {
      return NextResponse.json({ error: 'Customer has not consented to SMS' }, { status: 400 });
    }
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (!business.slug) {
      return NextResponse.json({ error: 'Business survey link is unavailable' }, { status: 400 });
    }

    const result = await sendReviewSurveyRequestForCustomer({
      business,
      customer,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 500 });
    }

    return NextResponse.json({ success: true, surveyUrl: result.surveyUrl });
  } catch (error: any) {
    console.error('POST /api/mobile/reviews/request error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send review request' },
      { status: 500 },
    );
  }
}
