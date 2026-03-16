import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { formatDirectCustomerMessageSMS, sendSMS } from '@/lib/twilio';

const MAX_MESSAGE_LENGTH = 500;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = session?.user?.businessId;

    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const rawMessage = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!rawMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    const [customer, business] = await Promise.all([
      prisma.customer.findFirst({
        where: {
          id,
          businessId,
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
        where: { id: businessId },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!customer.phone) {
      return NextResponse.json({ error: 'Customer has no phone number' }, { status: 400 });
    }

    if (!customer.smsConsent) {
      return NextResponse.json({ error: 'Customer has not consented to SMS' }, { status: 400 });
    }

    if (customer.smsOptedOut) {
      return NextResponse.json({ error: 'Customer has opted out of SMS' }, { status: 400 });
    }

    const message = formatDirectCustomerMessageSMS({
      businessName: business.name,
      message: rawMessage,
    });

    const smsResult = await sendSMS({
      to: customer.phone,
      message,
    });

    await prisma.smsLog.create({
      data: {
        businessId,
        toPhone: customer.phone,
        message,
        messageType: 'custom',
        status: smsResult.success ? 'sent' : 'failed',
        twilioSid: smsResult.sid ?? null,
        errorMessage: smsResult.error ?? null,
      },
    });

    if (!smsResult.success) {
      return NextResponse.json(
        { error: smsResult.error || 'Failed to send SMS' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST /api/customers/[id]/message error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
