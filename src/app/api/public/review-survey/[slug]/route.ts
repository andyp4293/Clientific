import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  parseReviewSurveyToken,
  type ReviewSurveyTokenPayload,
} from '@/lib/review-survey';
import {
  REVIEW_SURVEY_PRIVATE_NOTIFICATION_TYPE,
  REVIEW_SURVEY_TOP_RATING_NOTIFICATION_TYPE,
} from '@/lib/review-requests';
import { sanitizeExternalHttpUrl } from '@/lib/safe-url';

function isPublicBusinessId(value: string): boolean {
  return /^[A-Z]{2}-[A-Z0-9]{6}$/.test(value);
}

async function getBusinessByIdentifier(identifier: string) {
  return prisma.business.findUnique({
    where: isPublicBusinessId(identifier) ? { publicId: identifier } : { slug: identifier },
    select: {
      id: true,
      name: true,
      slug: true,
      publicId: true,
      logoUrl: true,
      googleReviewUrl: true,
      yelpUrl: true,
    },
  });
}

function getParsedToken(token: string | null, slug: string): ReviewSurveyTokenPayload | null {
  const parsed = parseReviewSurveyToken(token);
  return parsed?.s === slug ? parsed : null;
}

async function getMatchedCustomer({
  parsedToken,
  businessId,
}: {
  parsedToken: ReviewSurveyTokenPayload | null;
  businessId: string;
}) {
  if (!parsedToken) return null;

  return prisma.customer.findFirst({
    where: {
      id: parsedToken.c,
      businessId,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: identifier } = await params;
    const business = await getBusinessByIdentifier(identifier);

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const parsedToken = getParsedToken(req.nextUrl.searchParams.get('token'), business.slug);
    const customer = await getMatchedCustomer({
      parsedToken,
      businessId: business.id,
    });
    const customerName = customer?.name?.trim() || parsedToken?.n?.trim() || null;
    const googleReviewUrl = sanitizeExternalHttpUrl(business.googleReviewUrl);
    const yelpUrl = sanitizeExternalHttpUrl(business.yelpUrl);
    const preferredReviewUrl = googleReviewUrl || yelpUrl;

    return NextResponse.json({
      business: {
        name: business.name,
        slug: business.slug,
        logoUrl: sanitizeExternalHttpUrl(business.logoUrl),
        googleReviewUrl,
        yelpUrl,
        preferredReviewUrl,
        preferredReviewLabel: googleReviewUrl ? 'Google' : yelpUrl ? 'Yelp' : null,
      },
      customer: customerName
        ? {
            id: customer?.id ?? null,
            name: customerName,
          }
        : null,
    });
  } catch (error: any) {
    console.error('GET /api/public/review-survey/[slug] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load survey' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: identifier } = await params;
    const body = await req.json();
    const rating = Number(body?.rating);
    const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const business = await getBusinessByIdentifier(identifier);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    const googleReviewUrl = sanitizeExternalHttpUrl(business.googleReviewUrl);
    const yelpUrl = sanitizeExternalHttpUrl(business.yelpUrl);
    const preferredReviewUrl = googleReviewUrl || yelpUrl;
    const parsedToken = getParsedToken(
      typeof body?.token === 'string' ? body.token : null,
      business.slug,
    );

    const customer = await getMatchedCustomer({
      parsedToken,
      businessId: business.id,
    });
    const customerLabel = customer?.name?.trim() || parsedToken?.n?.trim() || 'A customer';

    const title =
      rating === 5 ? 'New 5-star survey response' : 'New private customer feedback';
    const message =
      rating === 5
        ? `${customerLabel} gave ${business.name} a 5 out of 5 and is ready for a public review.`
        : feedback
          ? `${customerLabel} rated ${business.name} ${rating}/5 and shared: "${feedback}"`
          : `${customerLabel} rated ${business.name} ${rating}/5 and did not leave written feedback.`;

    await prisma.notification.create({
      data: {
        businessId: business.id,
        type:
          rating === 5
            ? REVIEW_SURVEY_TOP_RATING_NOTIFICATION_TYPE
            : REVIEW_SURVEY_PRIVATE_NOTIFICATION_TYPE,
        title,
        message,
        link: customer ? `/dashboard/customers/${customer.id}` : '/dashboard/reviews',
      },
    });

    return NextResponse.json({
      success: true,
      preferredReviewUrl,
      preferredReviewLabel: googleReviewUrl ? 'Google' : yelpUrl ? 'Yelp' : null,
    });
  } catch (error: any) {
    console.error('POST /api/public/review-survey/[slug] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit survey' },
      { status: 500 }
    );
  }
}
