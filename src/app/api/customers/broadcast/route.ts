import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  CUSTOMER_BROADCAST_MAX_MESSAGE_LENGTH,
  CustomerBroadcastValidationError,
  getCustomerBroadcastAudience,
  normalizeCustomerBroadcastMessage,
  normalizeCustomerBroadcastTarget,
  sendCustomerBroadcast,
} from '@/lib/customer-broadcasts';
import { normalizeCustomerGroupIds } from '@/lib/customer-groups';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = session?.user?.businessId;

    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(businessId);
    if (subscriptionError) return subscriptionError;

    const body = await req.json();
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
        businessId,
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
      where: { id: businessId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const result = await sendCustomerBroadcast({
      businessId,
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

    console.error('POST /api/customers/broadcast error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send customer broadcast' },
      { status: 500 },
    );
  }
}
