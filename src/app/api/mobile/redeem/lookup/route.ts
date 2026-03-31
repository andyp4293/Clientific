import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatPhoneForDisplay } from '@/lib/phone';
import { requireMobileSession } from '@/lib/mobile-route';

function formatDiscountLabel(type: string, value: number) {
  if (type === 'percent_off') {
    return `${value}% off`;
  }

  if (type === 'amount_off') {
    return `$${value.toFixed(2)} off`;
  }

  return 'Free service';
}

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ error: 'Code is required.' }, { status: 400 });
    }

    const redemption = await prisma.dealRedemption.findUnique({
      where: { code },
      include: {
        deal: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    if (!redemption) {
      return NextResponse.json({ error: 'Code not found.' }, { status: 404 });
    }

    if (redemption.deal.businessId !== authorized.session.businessId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      deal: {
        title: redemption.deal.title,
        discountType: redemption.deal.discountType,
        discountValue: redemption.deal.discountValue,
        discountLabel: formatDiscountLabel(
          redemption.deal.discountType,
          redemption.deal.discountValue,
        ),
        platformFeePercent: (redemption.deal as { platformFeePercent?: number }).platformFeePercent ?? 10,
      },
      customer: redemption.customer
        ? {
            name: redemption.customer.name,
            phoneDisplay: formatPhoneForDisplay(redemption.customer.phone),
          }
        : null,
      alreadyUsed: redemption.usedAt !== null,
    });
  } catch (error) {
    console.error('GET /api/mobile/redeem/lookup error:', error);
    return NextResponse.json({ error: 'Unable to look up the code' }, { status: 500 });
  }
}
