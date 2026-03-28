import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sendReviewSurveyRequestForCustomer } from '@/lib/review-requests';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId } = await req.json();
    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    const [customer, business] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          phone: true,
          smsConsent: true,
          smsOptedOut: true,
          businessId: true,
        },
      }),
      prisma.business.findUnique({
        where: { id: session.user.id },
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

    if (!customer || customer.businessId !== session.user.id) {
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
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        smsConsent: customer.smsConsent,
        smsOptedOut: customer.smsOptedOut,
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 500 });
    }

    return NextResponse.json({ success: true, surveyUrl: result.surveyUrl });
  } catch (error: any) {
    console.error('POST /api/reviews/request error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send review request' },
      { status: 500 }
    );
  }
}
