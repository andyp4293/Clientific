import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import {
  buildCustomerPhoneMatchClauses,
  formatPhoneForDisplay,
  normalizeOptionalPhoneNumber,
} from '@/lib/phone';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const phone = request.nextUrl.searchParams.get('phone');
    const normalizedPhone = normalizeOptionalPhoneNumber(phone);
    const matchClauses = buildCustomerPhoneMatchClauses(phone);

    if (!normalizedPhone || matchClauses.length === 0) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId: session.user.businessId,
        OR: matchClauses,
      },
      orderBy: [{ lastVisit: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        lastVisit: true,
      },
      take: 5,
    });

    if (customers.length === 0) {
      return NextResponse.json({
        status: 'new',
        normalizedPhone,
        displayPhone: formatPhoneForDisplay(normalizedPhone),
      });
    }

    if (customers.length === 1) {
      return NextResponse.json({
        status: 'existing',
        customer: customers[0],
      });
    }

    return NextResponse.json({
      status: 'multiple',
      customers,
    });
  } catch (error) {
    console.error('GET /api/checkins/lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up customer' }, { status: 500 });
  }
}
