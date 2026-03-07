import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: {
        referralCode: true,
        referralCredits: true,
        referralsMade: {
          select: {
            id: true,
            createdAt: true,
            status: true,
            creditAmount: true,
            creditedAt: true,
            referee: {
              select: { name: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({
      referralCode: business.referralCode,
      totalCredits: business.referralCredits,
      referrals: business.referralsMade,
    });
  } catch (error: any) {
    console.error('Referrals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
  }
}
