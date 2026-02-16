import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get active staff for a business by publicId
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
    }    const staff = await prisma.staff.findMany({
      where: {
        businessId: business.id,
        active: true,
      },
      orderBy: {
        fullName: 'asc',
      },
      select: {
        id: true,
        fullName: true,
      },
    });

    return NextResponse.json({ staff });
  } catch (error: any) {
    console.error('Fetch staff error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch staff' },
      { status: 500 }
    );
  }
}
