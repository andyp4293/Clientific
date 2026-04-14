import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));

vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/review-requests', () => ({
  sendReviewSurveyRequestForCustomer: vi.fn(),
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { sendReviewSurveyRequestForCustomer } from '@/lib/review-requests';
import { POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindCustomer = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockSendReviewSurveyRequestForCustomer =
  sendReviewSurveyRequestForCustomer as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
  mockFindCustomer.mockResolvedValue({
    id: 'cust-1',
    name: 'Jordan Lee',
    phone: '+15551234567',
    smsConsent: true,
    smsOptedOut: false,
  });
  mockFindBusiness.mockResolvedValue({
    id: 'biz-1',
    name: 'Clientific Studio',
    slug: 'clientific-studio',
    publicId: 'CF-ABCD12',
    googleReviewUrl: null,
    yelpUrl: null,
  });
  mockSendReviewSurveyRequestForCustomer.mockResolvedValue({
    success: true,
    sid: 'SM123',
    surveyUrl: 'https://www.clientific.app/feedback/CF-ABCD12?token=abc123',
  });
});

describe('POST /api/mobile/reviews/request', () => {
  it('sends a review request for an eligible mobile customer', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/reviews/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customerId: 'cust-1' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockSendReviewSurveyRequestForCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        business: expect.objectContaining({
          id: 'biz-1',
          slug: 'clientific-studio',
        }),
        customer: expect.objectContaining({
          id: 'cust-1',
          name: 'Jordan Lee',
        }),
      }),
    );
  });

  it('returns 400 when the customer has not consented to SMS', async () => {
    mockFindCustomer.mockResolvedValue({
      id: 'cust-1',
      name: 'Jordan Lee',
      phone: '+15551234567',
      smsConsent: false,
      smsOptedOut: false,
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/reviews/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customerId: 'cust-1' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/consented to SMS/i),
    });
  });

  it('returns 400 when the business survey link is unavailable', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      name: 'Clientific Studio',
      slug: null,
      publicId: null,
      googleReviewUrl: null,
      yelpUrl: null,
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/reviews/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customerId: 'cust-1' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/survey link is unavailable/i),
    });
  });
});
