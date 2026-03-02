import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logs = await prisma.smsLog.findMany({
      where: { businessId: session.user.id, messageType: 'review_request' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('GET /api/reviews/recent error:', error);
    return NextResponse.json({ error: 'Failed to fetch review requests' }, { status: 500 });
  }
}
