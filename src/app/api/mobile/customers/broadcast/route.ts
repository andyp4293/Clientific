import { NextResponse } from 'next/server';
import {
  CUSTOMER_BROADCAST_MAX_MESSAGE_LENGTH,
  CustomerBroadcastValidationError,
  getCustomerBroadcastAudience,
  normalizeCustomerBroadcastMessage,
  normalizeCustomerBroadcastTarget,
  sendCustomerBroadcast,
} from '@/lib/customer-broadcasts';
import { normalizeCustomerGroupIds } from '@/lib/customer-groups';
import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const dryRun = body?.dryRun === true;
    const target = normalizeCustomerBroadcastTarget(body?.target);
    const groupIds = normalizeCustomerGroupIds(body?.groupIds);
    const rawMessage = normalizeCustomerBroadcastMessage(body?.message);

    if (!dryRun && !rawMessage) {
      return validationError('Message is required');
    }

    if (rawMessage.length > CUSTOMER_BROADCAST_MAX_MESSAGE_LENGTH) {
      return validationError(
        `Message must be ${CUSTOMER_BROADCAST_MAX_MESSAGE_LENGTH} characters or less`,
      );
    }

    if (!dryRun && body?.confirmSend !== true) {
      return validationError('Confirm the broadcast before sending');
    }

    if (dryRun) {
      const { recipients, ...summary } = await getCustomerBroadcastAudience({
        businessId: authorized.session.businessId,
        target,
        groupIds,
      });

      return NextResponse.json({
        ...summary,
        dryRun: true,
        sent: 0,
        failed: 0,
      });
    }

    const business = await prisma.business.findUnique({
      where: { id: authorized.session.businessId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const result = await sendCustomerBroadcast({
      businessId: authorized.session.businessId,
      businessName: business.name,
      target,
      groupIds,
      message: rawMessage,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof CustomerBroadcastValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('POST /api/mobile/customers/broadcast error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unable to send customer broadcast' },
      { status: 500 },
    );
  }
}
