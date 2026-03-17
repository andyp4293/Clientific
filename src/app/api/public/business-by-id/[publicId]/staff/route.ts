import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicStaff } from '@/lib/public-staff';

// GET - Get active staff for a business by publicId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;

    const business = await prisma.business.findUnique({
      where: { publicId },
      select: { id: true, enableOnlineBooking: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const infoOnly = req.nextUrl.searchParams.get('infoOnly') === 'true';

    if (!business.enableOnlineBooking && !infoOnly) {
      return NextResponse.json({ error: 'Online booking is not enabled' }, { status: 403 });
    }

    // Optional: filter to staff who can perform all of these service IDs
    const serviceIdsParam = req.nextUrl.searchParams.get('serviceIds');
    const requiredServiceIds = serviceIdsParam
      ? serviceIdsParam.split(',').filter(Boolean)
      : [];

    const staff = await getPublicStaff({ businessId: business.id, requiredServiceIds });

    return NextResponse.json({ staff });
  } catch (error: any) {
    console.error('Fetch staff error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch staff' },
      { status: 500 }
    );
  }
}
