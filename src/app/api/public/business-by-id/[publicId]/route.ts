import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get public business info by publicId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;

    const business = await prisma.business.findUnique({
      where: { publicId },
      select: {
        id: true,
        name: true,
        slug: true,
        publicId: true,
        businessType: true,
        phone: true,
        businessEmail: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        timezone: true,        logoUrl: true,
        enableOnlineBooking: true,
        businessHours: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    const infoOnly = req.nextUrl.searchParams.get('infoOnly') === 'true';

    if (!business.enableOnlineBooking && !infoOnly) {
      return NextResponse.json(
        { error: 'Online booking is not enabled for this business' },
        { status: 403 }
      );
    }

    return NextResponse.json({ business });
  } catch (error: any) {
    console.error('Fetch business by publicId error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch business' },
      { status: 500 }
    );
  }
}
