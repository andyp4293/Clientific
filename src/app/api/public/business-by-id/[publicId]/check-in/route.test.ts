import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    checkIn: { create: vi.fn(), update: vi.fn() },
    smsConsentEvent: { create: vi.fn() },
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/segment', () => ({ updateCustomerSegment: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/subscription', () => ({ requireActiveSubscription: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/review-requests', () => ({
  REVIEW_SURVEY_FOLLOW_UP_DELAY_MS: 2 * 60 * 60 * 1000,
  customerHasTopSurveyRating: vi.fn(),
  scheduleCheckInReviewSurveyRequest: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import {
  customerHasTopSurveyRating,
  scheduleCheckInReviewSurveyRequest,
} from '@/lib/review-requests';
import { requireActiveSubscription } from '@/lib/subscription';
import { GET, POST } from './route';

const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCheckInCreate = prisma.checkIn.create as ReturnType<typeof vi.fn>;
const mockCheckInUpdate = prisma.checkIn.update as ReturnType<typeof vi.fn>;
const mockCustomerFindMany = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockCustomerCreate = prisma.customer.create as ReturnType<typeof vi.fn>;
const mockCustomerUpdate = prisma.customer.update as ReturnType<typeof vi.fn>;
const mockSmsConsentEventCreate = prisma.smsConsentEvent.create as ReturnType<typeof vi.fn>;
const mockRequireActiveSubscription = requireActiveSubscription as ReturnType<typeof vi.fn>;
const mockCustomerHasTopSurveyRating = customerHasTopSurveyRating as ReturnType<typeof vi.fn>;
const mockScheduleCheckInReviewSurveyRequest =
  scheduleCheckInReviewSurveyRequest as ReturnType<typeof vi.fn>;

function makeParams(publicId = 'pub_123') {
  return { params: Promise.resolve({ publicId }) };
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/public/business-by-id/pub_123/check-in', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('public check-in route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActiveSubscription.mockResolvedValue(null);
    mockCheckInUpdate.mockResolvedValue({ id: 'ci-1' });
    mockCustomerHasTopSurveyRating.mockResolvedValue(false);
    mockSmsConsentEventCreate.mockResolvedValue({ id: 'evt-1' });
    mockScheduleCheckInReviewSurveyRequest.mockResolvedValue({
      success: true,
      surveyUrl: 'https://clientific.app/feedback/CF-8QXLBD?token=abc123',
      sid: 'SM123',
    });
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Test Salon',
      slug: 'test-salon',
      publicId: 'pub_123',
    });
  });

  it('looks up an existing customer by normalized phone', async () => {
    mockCustomerFindMany.mockResolvedValue([
      {
        id: 'cust-1',
        name: 'Andy',
        email: null,
        phone: '8482612613',
        phoneLookupKey: '8482612613',
        lastVisit: null,
      },
    ]);

    const req = new NextRequest(
      'http://localhost/api/public/business-by-id/pub_123/check-in?phone=%2B18482612613'
    );
    const res = await GET(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('existing');
    expect(mockCustomerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          OR: expect.arrayContaining([{ phoneLookupKey: '8482612613' }]),
        }),
      })
    );
  });

  it('returns multiple matches for duplicate normalized numbers', async () => {
    mockCustomerFindMany.mockResolvedValue([
      {
        id: 'cust-1',
        name: 'Andy',
        email: null,
        phone: '8482612613',
        phoneLookupKey: '8482612613',
        lastVisit: null,
      },
      {
        id: 'cust-2',
        name: 'Andy 2',
        email: 'alt@example.com',
        phone: '8482612613',
        phoneLookupKey: '8482612613',
        lastVisit: null,
      },
    ]);

    const req = new NextRequest(
      'http://localhost/api/public/business-by-id/pub_123/check-in?phone=8482612613'
    );
    const res = await GET(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('multiple');
    expect(body.customers).toHaveLength(2);
  });

  it('creates a new customer record, enables SMS consent, and schedules follow-up for an unknown phone number', async () => {
    mockCustomerFindMany.mockResolvedValue([]);
    mockCustomerCreate.mockResolvedValue({ id: 'cust-new' });
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-new',
      phone: '8482612613',
      phoneLookupKey: '8482612613',
    });
    mockCheckInCreate.mockResolvedValue({
      id: 'ci-1',
      checkInTime: '2026-03-23T16:00:00.000Z',
      customer: {
        id: 'cust-new',
        name: 'New Customer',
        phone: '8482612613',
        smsConsent: true,
        smsOptedOut: false,
      },
      service: null,
      staff: null,
    });
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-new' });

    const res = await POST(
      makePostRequest({
        phone: '8482612613',
        customerName: 'New Customer',
        customerEmail: 'customer@example.com',
        smsConsent: true,
      }),
      makeParams()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checkIn.id).toBe('ci-1');
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          name: 'New Customer',
          email: 'customer@example.com',
          phone: '8482612613',
          phoneLookupKey: '8482612613',
          smsConsent: true,
          smsMarketingConsent: true,
          smsMarketingConsentAt: expect.any(Date),
          optedInMarketing: true,
        }),
      })
    );
    expect(mockScheduleCheckInReviewSurveyRequest).toHaveBeenCalled();
    expect(mockSmsConsentEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          customerId: 'cust-new',
          phone: '8482612613',
          eventType: 'KIOSK_CHECK_IN_OPT_IN',
          source: 'in_store_check_in',
        }),
      })
    );
  });

  it('leaves SMS follow-up disabled when the kiosk opt-in is unchecked', async () => {
    mockCustomerFindMany.mockResolvedValue([]);
    mockCustomerCreate.mockResolvedValue({ id: 'cust-new' });
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-new',
      phone: '8482612613',
      phoneLookupKey: '8482612613',
    });
    mockCheckInCreate.mockResolvedValue({
      id: 'ci-2',
      checkInTime: '2026-03-23T16:00:00.000Z',
      customer: {
        id: 'cust-new',
        name: 'Quiet Customer',
        phone: '8482612613',
        smsConsent: false,
        smsOptedOut: false,
      },
      service: null,
      staff: null,
    });
    mockCustomerUpdate.mockResolvedValue({ id: 'cust-new' });

    const res = await POST(
      makePostRequest({
        phone: '8482612613',
        customerName: 'Quiet Customer',
        customerEmail: 'quiet@example.com',
        smsConsent: false,
      }),
      makeParams()
    );

    expect(res.status).toBe(200);
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsConsent: false,
          smsMarketingConsent: false,
          optedInMarketing: false,
        }),
      })
    );
    expect(mockScheduleCheckInReviewSurveyRequest).not.toHaveBeenCalled();
    expect(mockSmsConsentEventCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when a new phone number has no customer details', async () => {
    mockCustomerFindMany.mockResolvedValue([]);

    const res = await POST(makePostRequest({ phone: '8482612613' }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('CUSTOMER_DETAILS_REQUIRED');
  });

  it('returns subscription errors from the public flow', async () => {
    mockRequireActiveSubscription.mockResolvedValueOnce(
      NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
    );

    const req = new NextRequest(
      'http://localhost/api/public/business-by-id/pub_123/check-in?phone=8482612613'
    );
    const res = await GET(req, makeParams());

    expect(res.status).toBe(403);
  });
});
