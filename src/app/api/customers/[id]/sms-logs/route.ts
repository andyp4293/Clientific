import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { phone: true, businessId: true },
    });

    if (!customer || customer.businessId !== session.user.id) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (!customer.phone) {
      return NextResponse.json({ logs: [] });
    }

    const logs = await prisma.smsLog.findMany({
      where: { businessId: session.user.id, toPhone: customer.phone },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('GET /api/customers/[id]/sms-logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch SMS logs' }, { status: 500 });
  }
}
