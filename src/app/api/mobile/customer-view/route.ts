import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { requireMobileSession } from '@/lib/mobile-route';

function formatDiscountLabel(type: string, value: number) {
  if (type === 'percent_off') {
    return `${value}% off`;
  }

  if (type === 'amount_off') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  return 'Free';
}

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const [business, deals] = await Promise.all([
      prisma.business.findUnique({
        where: { id: authorized.session.businessId },
        select: {
          id: true,
          email: true,
          name: true,
          businessType: true,
          phone: true,
          street: true,
          city: true,
          state: true,
          zipCode: true,
          country: true,
          slug: true,
          publicId: true,
        },
      }),
      prisma.deal.findMany({
        where: {
          businessId: authorized.session.businessId,
          active: true,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          title: true,
          discountType: true,
          discountValue: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUrl = getConfiguredAppBaseUrl().replace(/\/$/, '');
    const bookingUrl = business.publicId
      ? `${appUrl}/book/${business.publicId}`
      : business.slug
        ? `${appUrl}/book/${business.slug}`
        : null;
    const profileUrl = business.publicId ? `${appUrl}/business/${business.publicId}` : null;

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      storeId: business.publicId ?? business.slug ?? null,
      bookingUrl,
      profileUrl,
      exploreUrl: `${appUrl}/explore`,
      deals: deals.map((deal) => ({
        id: deal.id,
        title: deal.title,
        discountLabel: formatDiscountLabel(deal.discountType, deal.discountValue),
        url: `${appUrl}/d/${deal.id}`,
      })),
    });
  } catch (error) {
    console.error('GET /api/mobile/customer-view error:', error);
    return NextResponse.json({ error: 'Unable to load customer view' }, { status: 500 });
  }
}
