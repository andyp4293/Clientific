import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatPhoneNumber } from '@/lib/twilio';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I, O, 0, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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

    const customerPhone = formatPhoneNumber(customerPhoneRaw);

    const deal = await prisma.deal.findUnique({ where: { id } });
    if (!deal || !deal.active) {
      return NextResponse.json({ error: 'Deal not found or inactive' }, { status: 404 });
    }

    const now = new Date();
    if (deal.startsAt > now || deal.expiresAt <= now) {
      return NextResponse.json({ error: 'Deal is not currently active' }, { status: 400 });
    }

    if (deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions) {
      return NextResponse.json({ error: 'Deal has reached maximum redemptions' }, { status: 400 });
    }

    // Find customer by phone to associate redemption when possible
    let customerId: string | null = null;
    const customer = await prisma.customer.findFirst({
      where: {
        businessId: deal.businessId,
        OR: [{ phone: customerPhone }, { phone: customerPhoneRaw }],
      },
      select: { id: true },
    });
    customerId = customer?.id ?? null;

    // Generate unique code with retry
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      const exists = await prisma.dealRedemption.findUnique({ where: { code } });
      if (!exists) break;
    }

    // Create redemption and increment count atomically
    const [redemption] = await prisma.$transaction([
      prisma.dealRedemption.create({
        data: { dealId: id, customerId, code },
      }),
      prisma.deal.update({
        where: { id },
        data: { redemptionCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ code: redemption.code, expiresAt: deal.expiresAt });
  } catch (error: any) {
    console.error('POST /api/public/deals/[id]/claim error:', error);
    return NextResponse.json({ error: 'Failed to claim deal' }, { status: 500 });
  }
}
