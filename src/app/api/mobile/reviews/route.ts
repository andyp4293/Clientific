import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { formatPhoneForDisplay } from '@/lib/phone';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { requireMobileSession } from '@/lib/mobile-route';

function formatSmsStatus(status: string | null) {
  if (!status) {
    return 'Sent';
  }

  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimestamp(value: Date) {
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const [business, logs] = await Promise.all([
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
          googleReviewUrl: true,
          yelpUrl: true,
        },
      }),
      prisma.smsLog.findMany({
        where: {
          businessId: authorized.session.businessId,
          messageType: 'review_request',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const surveyPath = business.publicId
      ? `/feedback/${business.publicId}`
      : business.slug
        ? `/feedback/${business.slug}`
        : null;
    const appUrl = getConfiguredAppBaseUrl();
    const surveyUrl = surveyPath ? `${appUrl}${surveyPath}` : null;
    const publicReviewDestinations = [
      business.googleReviewUrl
        ? { label: 'Google Reviews', url: business.googleReviewUrl }
        : null,
      business.yelpUrl ? { label: 'Yelp', url: business.yelpUrl } : null,
    ].filter((destination): destination is { label: string; url: string } => Boolean(destination));

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      storeId: business.publicId ?? business.slug,
      surveyPath,
      surveyUrl,
      publicReviewDestinations,
      hasPublicDestinations: publicReviewDestinations.length > 0,
      recentRequestsCount: logs.length,
      recentRequests: logs.map((log) => ({
        id: log.id,
        recipientLabel: formatPhoneForDisplay(log.toPhone),
        statusLabel: formatSmsStatus(log.status),
        createdAtLabel: formatTimestamp(log.createdAt),
      })),
    });
  } catch (error) {
    console.error('GET /api/mobile/reviews error:', error);
    return NextResponse.json({ error: 'Unable to load review tools' }, { status: 500 });
  }
}
