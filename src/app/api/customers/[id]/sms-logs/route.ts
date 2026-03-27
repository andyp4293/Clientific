import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDirectMessageQuotaStatus } from '@/lib/direct-message-quota';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const businessId = session?.user?.businessId ?? session?.user?.id;

    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { phone: true, businessId: true },
    });

    if (!customer || customer.businessId !== businessId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const quota = await getDirectMessageQuotaStatus(businessId);

    if (!customer.phone) {
      return NextResponse.json({ logs: [], quota });
    }

    const logs = await prisma.smsLog.findMany({
      where: { businessId, toPhone: customer.phone },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ logs, quota });
  } catch (error: any) {
    console.error('GET /api/customers/[id]/sms-logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch SMS logs' }, { status: 500 });
  }
}
