import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get active services for a business by publicId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;

    // Find business by publicId
    const business = await prisma.business.findUnique({
      where: { publicId },
      select: { id: true, enableOnlineBooking: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    if (!business.enableOnlineBooking) {
      return NextResponse.json(
        { error: 'Online booking is not enabled' },
        { status: 403 }
      );
    }

    const services = await prisma.service.findMany({
      where: {
        businessId: business.id,
        active: true,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        price: true,
      },
    });

    return NextResponse.json({ services });
  } catch (error: any) {
    console.error('Fetch services error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
