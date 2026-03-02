import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { sendReviewRequest } from '@/lib/twilio';

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
        select: { id: true, name: true, phone: true, smsConsent: true, smsOptedOut: true, businessId: true },
      }),
      prisma.business.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, googleReviewUrl: true, yelpUrl: true },
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
    if (!business.googleReviewUrl && !business.yelpUrl) {
      return NextResponse.json({ error: 'No review links configured — add them in Settings → Integrations' }, { status: 400 });
    }

    const result = await sendReviewRequest(customer.phone, {
      businessName: business.name,
      customerName: customer.name,
      googleReviewUrl: business.googleReviewUrl,
      yelpUrl: business.yelpUrl,
    });

    // Log the SMS
    await prisma.smsLog.create({
      data: {
        businessId: business.id,
        toPhone: customer.phone,
        message: result.success ? 'Review request sent' : `Failed: ${result.error}`,
        messageType: 'review_request',
        status: result.success ? 'sent' : 'failed',
        twilioSid: result.sid ?? null,
        errorMessage: result.error ?? null,
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST /api/reviews/request error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send review request' }, { status: 500 });
  }
}
