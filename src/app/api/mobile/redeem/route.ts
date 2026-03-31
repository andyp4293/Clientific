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

export async function POST(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const transactionAmount =
    typeof body.transactionAmount === 'number' ? body.transactionAmount : null;

  if (!code) {
    return NextResponse.json({ error: 'Code is required.' }, { status: 400 });
  }

  try {
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

    if (redemption.usedAt !== null) {
      return NextResponse.json({ error: 'Code already used.' }, { status: 400 });
    }

    const platformFeePercent =
      (redemption.deal as { platformFeePercent?: number }).platformFeePercent ?? 10;
    const platformFee =
      transactionAmount !== null
        ? Math.round(transactionAmount * platformFeePercent) / 100
        : null;

    await prisma.dealRedemption.update({
      where: { code },
      data: {
        usedAt: new Date(),
        transactionAmount: transactionAmount ?? null,
        platformFee,
      } as never,
    });

    return NextResponse.json({
      success: true,
      deal: {
        title: redemption.deal.title,
        discountType: redemption.deal.discountType,
        discountValue: redemption.deal.discountValue,
        discountLabel: formatDiscountLabel(
          redemption.deal.discountType,
          redemption.deal.discountValue,
        ),
      },
      customer: redemption.customer
        ? {
            name: redemption.customer.name,
            phoneDisplay: formatPhoneForDisplay(redemption.customer.phone),
          }
        : null,
      platformFee,
      platformFeeLabel:
        platformFee !== null
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(platformFee)
          : null,
    });
  } catch (error) {
    console.error('POST /api/mobile/redeem error:', error);
    return NextResponse.json({ error: 'Unable to redeem the code' }, { status: 500 });
  }
}
