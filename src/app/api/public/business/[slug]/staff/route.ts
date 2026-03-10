import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get staff for a business (public)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, enableOnlineBooking: true },
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
        { error: 'Online booking is not enabled' },
        { status: 403 }
      );
    }

    const staff = await prisma.staff.findMany({
      where: {
        businessId: business.id,
        active: true,
      },
      select: {
        id: true,
        fullName: true,
        role: true,
      },
      orderBy: {
        fullName: 'asc',
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
