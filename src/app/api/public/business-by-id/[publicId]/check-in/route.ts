import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  CheckInFlowError,
  createBusinessCheckIn,
  lookupBusinessCheckInCustomerByPhone,
} from '@/lib/checkins';
import { requireActiveSubscription } from '@/lib/subscription';

async function findBusinessId(publicId: string) {
  const business = await prisma.business.findUnique({
    where: { publicId },
    select: {
      id: true,
      name: true,
    },
  });

  return business;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const business = await findBusinessId(publicId);

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const subscriptionError = await requireActiveSubscription(business.id);
    if (subscriptionError) return subscriptionError;

    const phone = req.nextUrl.searchParams.get('phone') ?? '';
    const lookup = await lookupBusinessCheckInCustomerByPhone({
      businessId: business.id,
      phone,
    });

    return NextResponse.json(lookup);
  } catch (error) {
    if (error instanceof CheckInFlowError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
          ...(error.customers ? { customers: error.customers } : {}),
        },
        { status: error.status }
      );
    }

    console.error('GET /api/public/business-by-id/[publicId]/check-in error:', error);
    return NextResponse.json({ error: 'Failed to look up customer' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const business = await findBusinessId(publicId);

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const subscriptionError = await requireActiveSubscription(business.id);
    if (subscriptionError) return subscriptionError;

    const body = await req.json().catch(() => ({}));
    const {
      customerId,
      phone,
      customerName,
      customerEmail,
    } = body;

    const { checkIn } = await createBusinessCheckIn({
      businessId: business.id,
      customerId,
      phone,
      customerName,
      customerEmail,
    });

    return NextResponse.json({ checkIn });
  } catch (error) {
    if (error instanceof CheckInFlowError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.code ? { code: error.code } : {}),
          ...(error.customers ? { customers: error.customers } : {}),
        },
        { status: error.status }
      );
    }

    console.error('POST /api/public/business-by-id/[publicId]/check-in error:', error);
    return NextResponse.json({ error: 'Failed to check in customer' }, { status: 500 });
  }
}
