import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { getDirectMessageQuotaStatus } from '@/lib/direct-message-quota';
import {
  formatMobileDirectMessageQuota,
  formatMobileSmsLog,
} from '@/lib/mobile-customers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        phone: true,
        businessId: true,
      },
    });

    if (!customer || customer.businessId !== authorized.session.businessId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const quota = await getDirectMessageQuotaStatus(authorized.session.businessId);

    if (!customer.phone) {
      return NextResponse.json({ logs: [], quota: formatMobileDirectMessageQuota(quota) });
    }

    const logs = await prisma.smsLog.findMany({
      where: {
        businessId: authorized.session.businessId,
        toPhone: customer.phone,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      logs: logs.map(formatMobileSmsLog),
      quota: formatMobileDirectMessageQuota(quota),
    });
  } catch (error) {
    console.error('GET /api/mobile/customers/[id]/sms-logs error:', error);
    return NextResponse.json({ error: 'Unable to load message history' }, { status: 500 });
  }
}
