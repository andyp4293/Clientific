import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { sendSMS, formatPhoneNumber, appendSmsComplianceFooter } from '@/lib/twilio';
import { APP_URL } from '@/lib/brand';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { business: { select: { name: true, slug: true } } },
    });

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (deal.businessId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!deal.active) {
      return NextResponse.json({ error: 'Deal is not active' }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId: session.user.id,
        smsMarketingConsent: true,
        smsOptedOut: false,
        phone: { not: null },
      },
      select: { phone: true },
    });

    const message = appendSmsComplianceFooter(
      `${deal.business.name}: ${deal.title} -- claim your deal: ${APP_URL}/d/${deal.id}`
    );

    const results = await Promise.all(
      customers.map(c => sendSMS({ to: formatPhoneNumber(c.phone!), message }))
    );

    const sent = results.filter((r) => r.success).length;

    await prisma.deal.update({
      where: { id: deal.id },
      data: { notifiedAt: new Date() },
    });

    return NextResponse.json({ sent, dealId: deal.id });
  } catch (error: any) {
    console.error('POST /api/deals/[id]/notify error:', error?.message ?? error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
