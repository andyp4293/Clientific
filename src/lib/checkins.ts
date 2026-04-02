import { prisma } from '@/lib/prisma';
import {
  buildCustomerPhoneData,
  buildCustomerPhoneMatchClauses,
  formatPhoneForDisplay,
  normalizeOptionalStoredPhoneNumber,
} from '@/lib/phone';
import {
  customerHasTopSurveyRating,
  REVIEW_SURVEY_FOLLOW_UP_DELAY_MS,
  scheduleCheckInReviewSurveyRequest,
} from '@/lib/review-requests';
import { updateCustomerSegment } from '@/lib/segment';

export type CheckInCustomerSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneLookupKey?: string | null;
  lastVisit?: Date | null;
};

export type CheckInLookupResult =
  | { status: 'new'; normalizedPhone: string; displayPhone: string }
  | { status: 'existing'; customer: CheckInCustomerSummary }
  | { status: 'multiple'; customers: CheckInCustomerSummary[] };

export class CheckInFlowError extends Error {
  status: number;
  code?: string;
  customers?: CheckInCustomerSummary[];

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      customers?: CheckInCustomerSummary[];
    }
  ) {
    super(message);
    this.name = 'CheckInFlowError';
    this.status = options?.status ?? 400;
    this.code = options?.code;
    this.customers = options?.customers;
  }
}

export async function lookupBusinessCheckInCustomerByPhone({
  businessId,
  phone,
}: {
  businessId: string;
  phone: string;
}): Promise<CheckInLookupResult> {
  const normalizedPhone = normalizeOptionalStoredPhoneNumber(phone);
  const phoneData = buildCustomerPhoneData(phone);

  if (!normalizedPhone || !phoneData.phoneLookupKey) {
    throw new CheckInFlowError('Customer phone number required');
  }

  const matchingCustomers = await prisma.customer.findMany({
    where: {
      businessId,
      OR: buildCustomerPhoneMatchClauses(phone),
    },
    orderBy: [{ lastVisit: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneLookupKey: true,
      lastVisit: true,
    },
  });

  if (matchingCustomers.length > 1) {
    return { status: 'multiple', customers: matchingCustomers };
  }

  if (matchingCustomers.length === 1) {
    return {
      status: 'existing',
      customer: matchingCustomers[0],
    };
  }

  return {
    status: 'new',
    normalizedPhone,
    displayPhone: formatPhoneForDisplay(normalizedPhone) || normalizedPhone,
  };
}

export async function createBusinessCheckIn({
  businessId,
  customerId,
  serviceId,
  staffId,
  amountSpent,
  phone,
  customerName,
  customerEmail,
  smsConsent,
  smsMarketingConsent,
}: {
  businessId: string;
  customerId?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  amountSpent?: number;
  phone?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  smsConsent?: boolean;
  smsMarketingConsent?: boolean;
}) {
  const providedPhoneData = buildCustomerPhoneData(phone);
  const transactionalConsent = smsConsent === true || smsMarketingConsent === true;
  const marketingConsent = smsMarketingConsent === true;
  const consentCapturedAt = transactionalConsent || marketingConsent ? new Date() : null;
  let resolvedCustomerId =
    typeof customerId === 'string' && customerId.trim().length > 0 ? customerId.trim() : null;

  if (!resolvedCustomerId) {
    const lookup = await lookupBusinessCheckInCustomerByPhone({
      businessId,
      phone: phone ?? '',
    });

    if (lookup.status === 'multiple') {
      throw new CheckInFlowError('Multiple customers already use this number', {
        status: 409,
        code: 'MULTIPLE_CUSTOMERS_MATCH_PHONE',
        customers: lookup.customers,
      });
    }

    if (lookup.status === 'existing') {
      resolvedCustomerId = lookup.customer.id;

      if (
        lookup.customer.phone !== providedPhoneData.phone ||
        lookup.customer.phoneLookupKey !== providedPhoneData.phoneLookupKey
      ) {
        await prisma.customer.update({
          where: { id: lookup.customer.id },
          data: {
            phone: providedPhoneData.phone,
            phoneLookupKey: providedPhoneData.phoneLookupKey,
          },
        });
      }
    } else {
      if (typeof customerName !== 'string' || customerName.trim().length === 0) {
        throw new CheckInFlowError('Customer details required for a new phone number', {
          status: 400,
          code: 'CUSTOMER_DETAILS_REQUIRED',
        });
      }

      const createdCustomer = await prisma.customer.create({
        data: {
          businessId,
          name: customerName.trim(),
          email:
            typeof customerEmail === 'string' && customerEmail.trim().length > 0
              ? customerEmail.trim().toLowerCase()
              : null,
          phone: providedPhoneData.phone,
          phoneLookupKey: providedPhoneData.phoneLookupKey,
          segment: 'NEW',
          totalSpent: 0,
          smsConsent: transactionalConsent,
          smsMarketingConsent: marketingConsent,
          smsMarketingConsentAt: marketingConsent ? consentCapturedAt : null,
          optedInMarketing: marketingConsent,
          smsOptedOut: false,
          smsOptedOutAt: null,
          optedOutAt: marketingConsent ? null : undefined,
        },
        select: { id: true },
      });

      resolvedCustomerId = createdCustomer.id;
    }
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: resolvedCustomerId,
      businessId,
    },
    select: { id: true, phone: true, phoneLookupKey: true },
  });

  if (!customer) {
    throw new CheckInFlowError('Customer not found', { status: 404 });
  }

  if (
    providedPhoneData.phone &&
    (customer.phone !== providedPhoneData.phone ||
      customer.phoneLookupKey !== providedPhoneData.phoneLookupKey)
  ) {
    const customerUpdateData: Record<string, unknown> = {
      phone: providedPhoneData.phone,
      phoneLookupKey: providedPhoneData.phoneLookupKey,
    };

    if (transactionalConsent) {
      customerUpdateData.smsConsent = true;
      customerUpdateData.smsOptedOut = false;
      customerUpdateData.smsOptedOutAt = null;
    }

    if (marketingConsent && consentCapturedAt) {
      customerUpdateData.smsMarketingConsent = true;
      customerUpdateData.smsMarketingConsentAt = consentCapturedAt;
      customerUpdateData.optedInMarketing = true;
      customerUpdateData.optedOutAt = null;
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: customerUpdateData,
    });
  } else if (transactionalConsent || marketingConsent) {
    const customerUpdateData: Record<string, unknown> = {};

    if (transactionalConsent) {
      customerUpdateData.smsConsent = true;
      customerUpdateData.smsOptedOut = false;
      customerUpdateData.smsOptedOutAt = null;
    }

    if (marketingConsent && consentCapturedAt) {
      customerUpdateData.smsMarketingConsent = true;
      customerUpdateData.smsMarketingConsentAt = consentCapturedAt;
      customerUpdateData.optedInMarketing = true;
      customerUpdateData.optedOutAt = null;
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: customerUpdateData,
    });
  }

  const now = new Date();
  const checkIn = await prisma.checkIn.create({
    data: {
      businessId,
      customerId: customer.id,
      serviceId: serviceId || undefined,
      staffId: staffId || undefined,
      amountSpent: amountSpent || undefined,
      checkInTime: now,
    },
    include: {
      customer: true,
      service: true,
      staff: true,
    },
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      lastVisit: now,
      totalSpent: amountSpent ? { increment: amountSpent } : undefined,
    },
  });

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      publicId: true,
    },
  });

  if (!checkIn.customer.phone || !checkIn.customer.smsConsent || checkIn.customer.smsOptedOut) {
    await prisma.checkIn.update({
      where: { id: checkIn.id },
      data: {
        feedbackRequestedAt: now,
      },
    });
  } else if (!business?.slug || (!business.publicId && !business.slug)) {
    await prisma.checkIn.update({
      where: { id: checkIn.id },
      data: {
        feedbackRequestedAt: now,
      },
    });
  } else if (
    await customerHasTopSurveyRating({
      businessId,
      customerId: customer.id,
    })
  ) {
    await prisma.checkIn.update({
      where: { id: checkIn.id },
      data: {
        feedbackRequestedAt: now,
      },
    });
  } else {
    const surveySendAt = new Date(now.getTime() + REVIEW_SURVEY_FOLLOW_UP_DELAY_MS);
    const scheduledSurvey = await scheduleCheckInReviewSurveyRequest({
      business,
      customer: {
        id: checkIn.customer.id,
        name: checkIn.customer.name,
        phone: checkIn.customer.phone,
        smsConsent: checkIn.customer.smsConsent,
        smsOptedOut: checkIn.customer.smsOptedOut,
      },
      sendAt: surveySendAt,
    });

    if (scheduledSurvey.success) {
      await prisma.checkIn.update({
        where: { id: checkIn.id },
        data: {
          feedbackRequested: true,
          feedbackRequestedAt: surveySendAt,
        },
      });
    } else {
      console.error('Failed to schedule post-check-in survey request:', scheduledSurvey.error);
    }
  }

  updateCustomerSegment(customer.id).catch(console.error);

  return { checkIn };
}
