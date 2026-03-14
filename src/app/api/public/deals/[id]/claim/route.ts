import { NextRequest, NextResponse } from 'next/server';
import { claimDealForCustomer, DealClaimError } from '@/lib/deal-claims';

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

    return NextResponse.json({ code: claim.code, expiresAt: claim.expiresAt });
  } catch (error: any) {
    if (error instanceof DealClaimError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/public/deals/[id]/claim error:', error);
    return NextResponse.json({ error: 'Failed to claim deal' }, { status: 500 });
  }
}
