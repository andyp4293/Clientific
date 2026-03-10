import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get services for a business (public)
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

    const groups = await prisma.serviceGroup.findMany({
      where: { businessId: business.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
    });

    const services = await prisma.service.findMany({
      where: {
        businessId: business.id,
        active: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        groupId: true,
        name: true,
        description: true,
        duration: true,
        price: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ services, groups });
  } catch (error: any) {
    console.error('Fetch services error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
