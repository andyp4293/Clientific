import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { prisma } from '@/lib/prisma';

export type InStoreCaptureConfig = {
  business: {
    name: string;
    publicId: string;
    slug: string | null;
    logoUrl: string | null;
    publicProfileHeadline: string | null;
    bookingEnabled: boolean;
  };
  deal: {
    id: string;
    title: string;
    description: string | null;
    discountLabel: string;
    expiresAt: string;
    serviceName: string | null;
  } | null;
  captureUrl: string;
  bookingUrl: string | null;
};

export function formatDealDiscountLabel(discountType: string, discountValue: number): string {
  if (discountType === 'percent_off') return `${discountValue}% off`;
  if (discountType === 'amount_off') return `$${discountValue.toFixed(2)} off`;
  return 'Free service';
}

export async function getInStoreCaptureConfig({
  publicId,
  dealId,
  requestUrl,
}: {
  publicId: string;
  dealId?: string | null;
  requestUrl?: string;
}): Promise<InStoreCaptureConfig | null> {
  const business = await prisma.business.findUnique({
    where: { publicId },
    select: {
      id: true,
      name: true,
      publicId: true,
      slug: true,
      logoUrl: true,
      publicProfileHeadline: true,
      enableOnlineBooking: true,
    },
  });

  if (!business || !business.publicId) return null;

  const now = new Date();
  const activeDeal = dealId
    ? await prisma.deal.findFirst({
        where: {
          id: dealId,
          businessId: business.id,
          active: true,
          startsAt: { lte: now },
          expiresAt: { gt: now },
        },
        select: {
          id: true,
          title: true,
          description: true,
          discountType: true,
          discountValue: true,
          expiresAt: true,
          maxRedemptions: true,
          redemptionCount: true,
          service: { select: { name: true } },
        },
      })
    : null;

  const appBaseUrl = getAppBaseUrlFromRequest(requestUrl);
  const selectedDeal =
    activeDeal &&
    (activeDeal.maxRedemptions === null || activeDeal.redemptionCount < activeDeal.maxRedemptions)
      ? activeDeal
      : null;
  const selectedDealId = selectedDeal?.id ?? null;
  const captureUrl = `${appBaseUrl}/capture/${business.publicId}${selectedDealId ? `?deal=${selectedDealId}` : ''}`;
  const bookingUrl =
    business.enableOnlineBooking && business.slug
      ? `${appBaseUrl}/book/${business.slug}`
      : null;

  return {
    business: {
      name: business.name,
      publicId: business.publicId,
      slug: business.slug ?? null,
      logoUrl: business.logoUrl,
      publicProfileHeadline: business.publicProfileHeadline,
      bookingEnabled: business.enableOnlineBooking,
    },
    deal: selectedDeal
      ? {
          id: selectedDeal.id,
          title: selectedDeal.title,
          description: selectedDeal.description,
          discountLabel: formatDealDiscountLabel(selectedDeal.discountType, selectedDeal.discountValue),
          expiresAt: selectedDeal.expiresAt.toISOString(),
          serviceName: selectedDeal.service?.name ?? null,
        }
      : null,
    captureUrl,
    bookingUrl,
  };
}
