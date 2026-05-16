import { NextRequest } from 'next/server';
import { handlePublicBookingRequest } from '@/lib/public-booking-handler';

// POST - Create public booking (no auth required)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;

  return handlePublicBookingRequest({
    req,
    businessLookup: { publicId },
    consentChannel: 'public-business-public-id-book',
  });
}
