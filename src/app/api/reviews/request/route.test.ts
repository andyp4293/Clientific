import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: { findUnique: vi.fn() },
    business: { findUnique: vi.fn() },
    smsLog: { create: vi.fn() },
  },
}));

vi.mock('@/lib/twilio', () => ({
  sendReviewRequest: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { sendReviewRequest } from '@/lib/twilio';
import { POST } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockCustomerFindUnique = prisma.customer.findUnique as ReturnType<typeof vi.fn>;
const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockSmsLogCreate = prisma.smsLog.create as ReturnType<typeof vi.fn>;
const mockSendReviewRequest = sendReviewRequest as ReturnType<typeof vi.fn>;

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/reviews/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { id: 'biz-1' } });
  mockCustomerFindUnique.mockResolvedValue({
    id: 'cust-1',
    name: 'Andy Pham',
    phone: '+19087272437',
    smsConsent: true,
    smsOptedOut: false,
    businessId: 'biz-1',
  });
  mockBusinessFindUnique.mockResolvedValue({
    id: 'biz-1',
    name: 'Davi Nails',
    slug: 'davi-nails',
    googleReviewUrl: null,
    yelpUrl: null,
  });
  mockSendReviewRequest.mockResolvedValue({
    success: true,
    sid: 'SM123',
  });
  mockSmsLogCreate.mockResolvedValue({ id: 'log-1' });
});

describe('POST /api/reviews/request', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ customerId: 'cust-1' }));

    expect(res.status).toBe(401);
  });

  it('sends the customer to the survey link even without Google or Yelp configured', async () => {
    const res = await POST(makeRequest({ customerId: 'cust-1' }));

    expect(res.status).toBe(200);
    expect(mockSendReviewRequest).toHaveBeenCalledWith(
      '+19087272437',
      expect.objectContaining({
        businessName: 'Davi Nails',
        customerName: 'Andy Pham',
        surveyUrl: expect.stringContaining('/feedback/davi-nails?token='),
      })
    );
    expect(mockSmsLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messageType: 'review_request',
          status: 'sent',
        }),
      })
    );
  });

  it('returns 400 when the business survey link is unavailable', async () => {
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Davi Nails',
      slug: null,
      googleReviewUrl: null,
      yelpUrl: null,
    });

    const res = await POST(makeRequest({ customerId: 'cust-1' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/survey link is unavailable/i);
  });
});
