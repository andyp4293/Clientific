import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    smsLog: { create: vi.fn() },
    notification: { findFirst: vi.fn() },
    checkIn: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/twilio', async () => {
  const actual = await vi.importActual<typeof import('./twilio')>('./twilio');
  return {
    ...actual,
    sendReviewRequest: vi.fn(),
  };
});

import { prisma } from '@/lib/prisma';
import { sendReviewRequest } from '@/lib/twilio';
import {
  customerHasTopSurveyRating,
  processPendingCheckInReviewRequests,
  REVIEW_SURVEY_TOP_RATING_NOTIFICATION_TYPE,
  sendReviewSurveyRequestForCustomer,
} from './review-requests';

const mockSmsLogCreate = prisma.smsLog.create as ReturnType<typeof vi.fn>;
const mockNotificationFindFirst = prisma.notification.findFirst as ReturnType<typeof vi.fn>;
const mockCheckInFindMany = prisma.checkIn.findMany as ReturnType<typeof vi.fn>;
const mockCheckInUpdate = prisma.checkIn.update as ReturnType<typeof vi.fn>;
const mockSendReviewRequest = sendReviewRequest as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSmsLogCreate.mockResolvedValue({ id: 'log-1' });
  mockNotificationFindFirst.mockResolvedValue(null);
  mockCheckInFindMany.mockResolvedValue([]);
  mockCheckInUpdate.mockResolvedValue({ id: 'checkin-1' });
  mockSendReviewRequest.mockResolvedValue({ success: true, sid: 'SM123' });
});

describe('sendReviewSurveyRequestForCustomer', () => {
  it('builds a signed survey link, sends the SMS, and logs the send', async () => {
    const result = await sendReviewSurveyRequestForCustomer({
      business: {
        id: 'biz-1',
        name: 'Davi Nails',
        slug: 'davi-nails',
        publicId: 'CF-8QXLBD',
      },
      customer: {
        id: 'cust-1',
        name: 'Andy Pham',
        phone: '+19087272437',
        smsConsent: true,
        smsOptedOut: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.surveyUrl).toContain('/feedback/CF-8QXLBD?token=');
    expect(mockSendReviewRequest).toHaveBeenCalledWith(
      '+19087272437',
      expect.objectContaining({
        businessName: 'Davi Nails',
        customerName: 'Andy Pham',
        surveyUrl: expect.stringContaining('/feedback/CF-8QXLBD?token='),
      })
    );
    expect(mockSmsLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          toPhone: '+19087272437',
          messageType: 'review_request',
          status: 'sent',
          twilioSid: 'SM123',
        }),
      })
    );
  });

  it('still returns success when the sms log write fails after Twilio succeeds', async () => {
    mockSmsLogCreate.mockRejectedValue(new Error('db write failed'));

    const result = await sendReviewSurveyRequestForCustomer({
      business: {
        id: 'biz-1',
        name: 'Davi Nails',
        slug: 'davi-nails',
        publicId: 'CF-8QXLBD',
      },
      customer: {
        id: 'cust-1',
        name: 'Andy Pham',
        phone: '+19087272437',
        smsConsent: true,
        smsOptedOut: false,
      },
    });

    expect(result.success).toBe(true);
    expect(mockSendReviewRequest).toHaveBeenCalledOnce();
  });
});

describe('customerHasTopSurveyRating', () => {
  it('checks for a prior 5-star notification tied to the customer', async () => {
    mockNotificationFindFirst.mockResolvedValueOnce({ id: 'notif-1' });

    const hasTopRating = await customerHasTopSurveyRating({
      businessId: 'biz-1',
      customerId: 'cust-1',
    });

    expect(hasTopRating).toBe(true);
    expect(mockNotificationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: 'biz-1',
          type: REVIEW_SURVEY_TOP_RATING_NOTIFICATION_TYPE,
          link: '/dashboard/customers/cust-1',
        },
      })
    );
  });
});

describe('processPendingCheckInReviewRequests', () => {
  const now = new Date('2026-03-28T16:00:00.000Z');

  it('sends survey texts for eligible check-ins older than two hours and marks them handled', async () => {
    mockCheckInFindMany.mockResolvedValueOnce([
      {
        id: 'checkin-1',
        checkInTime: new Date('2026-03-28T13:30:00.000Z'),
        business: {
          id: 'biz-1',
          name: 'Davi Nails',
          slug: 'davi-nails',
          publicId: 'CF-8QXLBD',
        },
        customer: {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: '+19087272437',
          smsConsent: true,
          smsOptedOut: false,
        },
      },
    ]);

    const result = await processPendingCheckInReviewRequests({ now });

    expect(result).toEqual(
      expect.objectContaining({
        scanned: 1,
        sent: 1,
        skippedTopRated: 0,
        failed: 0,
      })
    );
    expect(mockCheckInFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          feedbackRequestedAt: null,
          checkInTime: { lte: new Date('2026-03-28T14:00:00.000Z') },
        }),
      })
    );
    expect(mockCheckInUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'checkin-1' },
        data: {
          feedbackRequested: true,
          feedbackRequestedAt: now,
        },
      })
    );
  });

  it('skips customers who already gave a 5-star survey and still marks the check-in handled', async () => {
    mockCheckInFindMany.mockResolvedValueOnce([
      {
        id: 'checkin-1',
        checkInTime: new Date('2026-03-28T13:30:00.000Z'),
        business: {
          id: 'biz-1',
          name: 'Davi Nails',
          slug: 'davi-nails',
          publicId: 'CF-8QXLBD',
        },
        customer: {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: '+19087272437',
          smsConsent: true,
          smsOptedOut: false,
        },
      },
    ]);
    mockNotificationFindFirst.mockResolvedValueOnce({ id: 'notif-1' });

    const result = await processPendingCheckInReviewRequests({ now });

    expect(result).toEqual(
      expect.objectContaining({
        scanned: 1,
        sent: 0,
        skippedTopRated: 1,
      })
    );
    expect(mockSendReviewRequest).not.toHaveBeenCalled();
    expect(mockCheckInUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'checkin-1' },
        data: {
          feedbackRequestedAt: now,
        },
      })
    );
  });

  it('skips customers who cannot be texted and marks the check-in handled', async () => {
    mockCheckInFindMany.mockResolvedValueOnce([
      {
        id: 'checkin-1',
        checkInTime: new Date('2026-03-28T13:30:00.000Z'),
        business: {
          id: 'biz-1',
          name: 'Davi Nails',
          slug: 'davi-nails',
          publicId: 'CF-8QXLBD',
        },
        customer: {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: null,
          smsConsent: true,
          smsOptedOut: false,
        },
      },
    ]);

    const result = await processPendingCheckInReviewRequests({ now });

    expect(result).toEqual(
      expect.objectContaining({
        scanned: 1,
        skippedNoPhoneOrConsent: 1,
      })
    );
    expect(mockSendReviewRequest).not.toHaveBeenCalled();
    expect(mockCheckInUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'checkin-1' },
        data: {
          feedbackRequestedAt: now,
        },
      })
    );
  });

  it('leaves the check-in pending for retry when Twilio send fails', async () => {
    mockCheckInFindMany.mockResolvedValueOnce([
      {
        id: 'checkin-1',
        checkInTime: new Date('2026-03-28T13:30:00.000Z'),
        business: {
          id: 'biz-1',
          name: 'Davi Nails',
          slug: 'davi-nails',
          publicId: 'CF-8QXLBD',
        },
        customer: {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: '+19087272437',
          smsConsent: true,
          smsOptedOut: false,
        },
      },
    ]);
    mockSendReviewRequest.mockResolvedValueOnce({
      success: false,
      error: 'Twilio unavailable',
    });

    const result = await processPendingCheckInReviewRequests({ now });

    expect(result).toEqual(
      expect.objectContaining({
        scanned: 1,
        sent: 0,
        failed: 1,
      })
    );
    expect(mockCheckInUpdate).not.toHaveBeenCalled();
  });
});
