import { NextRequest, NextResponse } from 'next/server';
import { claimDealForCustomer, DealClaimError } from '@/lib/deal-claims';
import { prisma } from '@/lib/prisma';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { formatDealClaimCodeSMS, formatPhoneNumber, sendSMS } from '@/lib/twilio';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const customerPhoneRaw = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';

    if (!customerPhoneRaw) {
      return NextResponse.json({ error: 'customerPhone is required' }, { status: 400 });
    }
    const claim = await claimDealForCustomer({
      dealId: id,
      customerPhone: customerPhoneRaw,
    });

    const business = await prisma.business.findUnique({
      where: { id: claim.deal.businessId },
      select: {
        name: true,
        slug: true,
        enableOnlineBooking: true,
        vapiPhoneNumber: true,
      },
    });

    const appBaseUrl = getAppBaseUrlFromRequest(req.url);
    const bookingUrl =
      business?.enableOnlineBooking && business.slug
        ? `${appBaseUrl}/book/${business.slug}`
        : null;

    const smsResult = await sendSMS({
      to: formatPhoneNumber(customerPhoneRaw),
      from: business?.vapiPhoneNumber ?? null,
      message: formatDealClaimCodeSMS({
        businessName: business?.name ?? 'Clientific',
        dealTitle: claim.deal.title,
        dealCode: claim.code,
        bookingUrl,
      }),
    });

    return NextResponse.json({
      code: claim.code,
      expiresAt: claim.expiresAt,
      confirmationSent: smsResult.success,
    });
  } catch (error: any) {
    if (error instanceof DealClaimError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/public/deals/[id]/claim error:', error);
    return NextResponse.json({ error: 'Failed to claim deal' }, { status: 500 });
  }
}
