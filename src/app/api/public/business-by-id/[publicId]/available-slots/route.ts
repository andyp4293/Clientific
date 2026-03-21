import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicAvailableSlots,
  PublicAvailableSlotsError,
} from '@/lib/public-available-slots';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const { searchParams } = new URL(req.url);
    const rawServiceIds = searchParams.get('serviceIds');

    const result = await getPublicAvailableSlots({
      businessLookup: { publicId },
      date: searchParams.get('date'),
      serviceId: searchParams.get('serviceId'),
      serviceIds: rawServiceIds
        ? rawServiceIds.split(',').map((value) => value.trim()).filter(Boolean)
        : null,
      staffId: searchParams.get('staffId'),
      durationOverride: searchParams.get('duration'),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Fetch available slots error:', error);
    if (error instanceof PublicAvailableSlotsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to fetch available slots' },
      { status: 500 }
    );
  }
}
