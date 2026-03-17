import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const purchase = await prisma.dealPurchase.findUnique({
      where: { token },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            description: true,
            discountType: true,
            discountValue: true,
            expiresAt: true,
          },
        },
        business: {
          select: {
            name: true,
            slug: true,
            publicId: true,
            city: true,
            state: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            serviceName: true,
            quantity: true,
            originalUnitAmount: true,
            discountedUnitAmount: true,
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    return NextResponse.json({
      purchase: {
        id: purchase.id,
        token: purchase.token,
        status: purchase.status,
        customerName: purchase.customerName,
        customerPhone: purchase.customerPhone,
        customerEmail: purchase.customerEmail,
        subtotalAmount: purchase.subtotalAmount,
        discountAmount: purchase.discountAmount,
        totalAmount: purchase.totalAmount,
        applicationFeeAmount: purchase.applicationFeeAmount,
        businessNetAmount: purchase.businessNetAmount,
        stripeReceiptUrl: purchase.stripeReceiptUrl,
        redemptionCode: purchase.redemptionCode,
        purchasedAt: purchase.purchasedAt,
        redeemedAt: purchase.redeemedAt,
        expiresAt: purchase.expiresAt,
        smsConfirmationSentAt: purchase.smsConfirmationSentAt,
        deal: purchase.deal,
        business: purchase.business,
        items: purchase.items,
      },
    });
  } catch (error: any) {
    console.error('GET /api/public/deal-purchases/[token] error:', error);
    return NextResponse.json({ error: 'Failed to load purchase receipt' }, { status: 500 });
  }
}
