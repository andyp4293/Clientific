import { prisma } from '@/lib/prisma';
import { buildReviewSurveyUrl, createReviewSurveyToken } from '@/lib/review-survey';
import { sendReviewRequest, type SMSResult } from '@/lib/twilio';

export const REVIEW_SURVEY_TOP_RATING_NOTIFICATION_TYPE = 'review_feedback_5_star';
export const REVIEW_SURVEY_PRIVATE_NOTIFICATION_TYPE = 'review_feedback_private';
export const REVIEW_SURVEY_FOLLOW_UP_DELAY_MS = 2 * 60 * 60 * 1000;

type ReviewRequestBusiness = {
  id: string;
  name: string;
  slug: string | null;
  publicId: string | null;
};

type ReviewRequestCustomer = {
  id: string;
  name: string;
  phone: string | null;
  smsConsent: boolean;
  smsOptedOut: boolean;
};

type ReviewRequestSendResult = {
  success: boolean;
  surveyUrl: string;
  sid?: string;
  error?: string;
};

function getReviewSurveyIdentifier(business: ReviewRequestBusiness): string | null {
  return business.publicId || business.slug || null;
}

function buildCustomerReviewSurveyLink({
  business,
  customer,
}: {
  business: ReviewRequestBusiness;
  customer: Pick<ReviewRequestCustomer, 'id' | 'name'>;
}): string | null {
  const identifier = getReviewSurveyIdentifier(business);
  if (!identifier || !business.slug) {
    return null;
  }

  const surveyToken = createReviewSurveyToken({
    s: business.slug,
    c: customer.id,
    n: customer.name || undefined,
    e: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });

  return buildReviewSurveyUrl(identifier, surveyToken);
}

async function createReviewSmsLog({
  businessId,
  phone,
  result,
}: {
  businessId: string;
  phone: string;
  result: SMSResult;
}) {
  try {
    await prisma.smsLog.create({
      data: {
        businessId,
        toPhone: phone,
        message: result.success ? 'Review survey request sent' : `Failed: ${result.error}`,
        messageType: 'review_request',
        status: result.success ? 'sent' : 'failed',
        twilioSid: result.sid ?? null,
        errorMessage: result.error ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to create review SMS log:', error);
  }
}

export async function customerHasTopSurveyRating({
  businessId,
  customerId,
}: {
  businessId: string;
  customerId: string;
}) {
  const notification = await prisma.notification.findFirst({
    where: {
      businessId,
      type: REVIEW_SURVEY_TOP_RATING_NOTIFICATION_TYPE,
      link: `/dashboard/customers/${customerId}`,
    },
    select: { id: true },
  });

  return Boolean(notification);
}

export async function sendReviewSurveyRequestForCustomer({
  business,
  customer,
}: {
  business: ReviewRequestBusiness;
  customer: ReviewRequestCustomer;
}): Promise<ReviewRequestSendResult> {
  if (!customer.phone) {
    return { success: false, surveyUrl: '', error: 'Customer has no phone number' };
  }

  const surveyUrl = buildCustomerReviewSurveyLink({ business, customer });
  if (!surveyUrl) {
    return { success: false, surveyUrl: '', error: 'Business survey link is unavailable' };
  }

  const result = await sendReviewRequest(customer.phone, {
    businessName: business.name,
    customerName: customer.name,
    surveyUrl,
  });

  await createReviewSmsLog({
    businessId: business.id,
    phone: customer.phone,
    result,
  });

  return {
    success: result.success,
    surveyUrl,
    sid: result.sid,
    error: result.error,
  };
}

export async function processPendingCheckInReviewRequests({
  now = new Date(),
}: {
  now?: Date;
} = {}) {
  const cutoff = new Date(now.getTime() - REVIEW_SURVEY_FOLLOW_UP_DELAY_MS);
  const eligibleCheckIns = await prisma.checkIn.findMany({
    where: {
      checkInTime: { lte: cutoff },
      feedbackRequestedAt: null,
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          publicId: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          smsConsent: true,
          smsOptedOut: true,
        },
      },
    },
    orderBy: { checkInTime: 'asc' },
    take: 200,
  });

  const summary = {
    scanned: eligibleCheckIns.length,
    sent: 0,
    skippedNoPhoneOrConsent: 0,
    skippedNoSurveyLink: 0,
    skippedTopRated: 0,
    failed: 0,
  };

  for (const checkIn of eligibleCheckIns) {
    const customer = checkIn.customer;
    const business = checkIn.business;

    if (!customer.phone || !customer.smsConsent || customer.smsOptedOut) {
      summary.skippedNoPhoneOrConsent += 1;
      await prisma.checkIn.update({
        where: { id: checkIn.id },
        data: {
          feedbackRequestedAt: now,
        },
      });
      continue;
    }

    if (!getReviewSurveyIdentifier(business) || !business.slug) {
      summary.skippedNoSurveyLink += 1;
      await prisma.checkIn.update({
        where: { id: checkIn.id },
        data: {
          feedbackRequestedAt: now,
        },
      });
      continue;
    }

    if (
      await customerHasTopSurveyRating({
        businessId: business.id,
        customerId: customer.id,
      })
    ) {
      summary.skippedTopRated += 1;
      await prisma.checkIn.update({
        where: { id: checkIn.id },
        data: {
          feedbackRequestedAt: now,
        },
      });
      continue;
    }

    const result = await sendReviewSurveyRequestForCustomer({
      business,
      customer,
    });

    if (!result.success) {
      summary.failed += 1;
      continue;
    }

    summary.sent += 1;
    await prisma.checkIn.update({
      where: { id: checkIn.id },
      data: {
        feedbackRequested: true,
        feedbackRequestedAt: now,
      },
    });
  }

  return {
    ok: true,
    ranAt: now.toISOString(),
    cutoff: cutoff.toISOString(),
    ...summary,
  };
}
