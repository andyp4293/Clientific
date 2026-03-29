import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    smsLog: { create: vi.fn() },
    notification: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/twilio', async () => {
  const actual = await vi.importActual<typeof import('./twilio')>('./twilio');
  return {
    ...actual,
    sendReviewRequest: vi.fn(),
  };
});

vi.mock('@/lib/review-request-scheduler', () => ({
  scheduleReviewRequest: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { sendReviewRequest } from '@/lib/twilio';
import { scheduleReviewRequest } from '@/lib/review-request-scheduler';
import {
  customerHasTopSurveyRating,
  REVIEW_SURVEY_TOP_RATING_NOTIFICATION_TYPE,
  scheduleCheckInReviewSurveyRequest,
  sendReviewSurveyRequestForCustomer,
} from './review-requests';

const mockSmsLogCreate = prisma.smsLog.create as ReturnType<typeof vi.fn>;
const mockNotificationFindFirst = prisma.notification.findFirst as ReturnType<typeof vi.fn>;
const mockSendReviewRequest = sendReviewRequest as ReturnType<typeof vi.fn>;
const mockScheduleReviewRequest = scheduleReviewRequest as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSmsLogCreate.mockResolvedValue({ id: 'log-1' });
  mockNotificationFindFirst.mockResolvedValue(null);
  mockSendReviewRequest.mockResolvedValue({ success: true, sid: 'SM123' });
  mockScheduleReviewRequest.mockResolvedValue({ success: true, sid: 'SM456' });
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

describe('scheduleCheckInReviewSurveyRequest', () => {
  it('schedules the review request for later and logs the request as scheduled', async () => {
    const sendAt = new Date('2026-03-28T18:00:00.000Z');

    const result = await scheduleCheckInReviewSurveyRequest({
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
      sendAt,
    });

    expect(result.success).toBe(true);
    expect(result.surveyUrl).toContain('/feedback/CF-8QXLBD?token=');
    expect(mockScheduleReviewRequest).toHaveBeenCalledWith(
      '+19087272437',
      expect.objectContaining({
        businessName: 'Davi Nails',
        customerName: 'Andy Pham',
        surveyUrl: expect.stringContaining('/feedback/CF-8QXLBD?token='),
      }),
      sendAt
    );
    expect(mockSmsLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'scheduled',
          twilioSid: 'SM456',
          message: 'Review survey request scheduled',
        }),
      })
    );
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
