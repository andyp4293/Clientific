import { NextRequest } from 'next/server';
import { handlePublicBookingRequest } from '@/lib/public-booking-handler';

// POST - Create public booking (no auth required)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  return handlePublicBookingRequest({
    req,
    businessLookup: { slug },
    consentChannel: 'public-business-slug-book',
  });
}
