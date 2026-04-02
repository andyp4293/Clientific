import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import {
  finalizeDirectMessageQuotaReservation,
  reserveDirectMessageQuota,
} from '@/lib/direct-message-quota';
import { formatDirectCustomerMessageSMS, sendSMS } from '@/lib/twilio';
import { formatMobileDirectMessageQuota } from '@/lib/mobile-customers';

const MAX_MESSAGE_LENGTH = 500;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const rawMessage = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!rawMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    const [customer, business] = await Promise.all([
      prisma.customer.findFirst({
        where: {
          id,
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

    const quotaReservation = await reserveDirectMessageQuota({
      businessId: authorized.session.businessId,
      toPhone: customer.phone,
      message,
    });

    if (!quotaReservation.allowed) {
      const status =
        quotaReservation.code === 'DIRECT_MESSAGE_LIMIT_REACHED'
          ? 403
          : quotaReservation.code === 'SUBSCRIPTION_REQUIRED'
            ? 403
            : 404;

      return NextResponse.json(
        {
          error: quotaReservation.error,
          code: quotaReservation.code,
          quota: formatMobileDirectMessageQuota(quotaReservation.quota ?? null),
        },
        { status },
      );
    }

    const smsResult = await sendSMS({
      to: customer.phone,
      message,
    });

    await finalizeDirectMessageQuotaReservation({
      logId: quotaReservation.logId,
      success: smsResult.success,
      sid: smsResult.sid ?? null,
      error: smsResult.error ?? null,
    });

    if (!smsResult.success) {
      return NextResponse.json(
        { error: smsResult.error || 'Failed to send SMS' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      quota: formatMobileDirectMessageQuota(quotaReservation.quota ?? null),
    });
  } catch (error: any) {
    console.error('POST /api/mobile/customers/[id]/message error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unable to send the message' },
      { status: 500 },
    );
  }
}
