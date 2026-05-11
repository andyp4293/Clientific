import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    customer: { findFirst: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { createReviewSurveyToken } from '@/lib/review-survey';
import { GET, POST } from './route';

const mockBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockCustomerFindFirst = prisma.customer.findFirst as ReturnType<typeof vi.fn>;
const mockNotificationCreate = prisma.notification.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockBusinessFindUnique.mockResolvedValue({
    id: 'biz-1',
    name: 'Davi Nails',
    slug: 'davi-nails',
    publicId: 'CF-8QXLBD',
    logoUrl: null,
    googleReviewUrl: 'https://google.com/review',
    yelpUrl: null,
  });
});

describe('GET /api/public/review-survey/[slug]', () => {
  it('returns the business and matched customer from a signed token', async () => {
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Andy Pham',
    });

    const token = createReviewSurveyToken({
      s: 'davi-nails',
      c: 'cust-1',
      n: 'Andy Pham',
      e: Date.now() + 60_000,
    });

    const req = new NextRequest(
      `http://localhost/api/public/review-survey/davi-nails?token=${encodeURIComponent(token)}`
    );
    const res = await GET(req, { params: Promise.resolve({ slug: 'davi-nails' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.business.preferredReviewUrl).toBe('https://google.com/review');
    expect(body.customer).toEqual({
      id: 'cust-1',
      name: 'Andy Pham',
    });
  });

  it('falls back to the token name when the customer record is gone', async () => {
    mockCustomerFindFirst.mockResolvedValue(null);

    const token = createReviewSurveyToken({
      s: 'davi-nails',
      c: 'cust-1',
      n: 'Andy Pham',
      e: Date.now() + 60_000,
    });

    const req = new NextRequest(
      `http://localhost/api/public/review-survey/davi-nails?token=${encodeURIComponent(token)}`
    );
    const res = await GET(req, { params: Promise.resolve({ slug: 'davi-nails' }) });

    const body = await res.json();
    expect(body.customer).toEqual({
      id: null,
      name: 'Andy Pham',
    });
  });

  it('accepts the public store ID in the survey path and still validates the slug token', async () => {
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Andy Pham',
    });

    const token = createReviewSurveyToken({
      s: 'davi-nails',
      c: 'cust-1',
      n: 'Andy Pham',
      e: Date.now() + 60_000,
    });

    const req = new NextRequest(
      `http://localhost/api/public/review-survey/CF-8QXLBD?token=${encodeURIComponent(token)}`
    );
    const res = await GET(req, { params: Promise.resolve({ slug: 'CF-8QXLBD' }) });

    expect(res.status).toBe(200);
    expect(mockBusinessFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publicId: 'CF-8QXLBD' },
      })
    );
  });

  it('does not return unsafe public review links', async () => {
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Davi Nails',
      slug: 'davi-nails',
      publicId: 'CF-8QXLBD',
      logoUrl: 'javascript:alert(1)',
      googleReviewUrl: 'javascript:alert(1)',
      yelpUrl: 'https://yelp.com/biz/davi-nails',
    });
    mockCustomerFindFirst.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/public/review-survey/davi-nails');
    const res = await GET(req, { params: Promise.resolve({ slug: 'davi-nails' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.business.logoUrl).toBeNull();
    expect(body.business.googleReviewUrl).toBeNull();
    expect(body.business.preferredReviewUrl).toBe('https://yelp.com/biz/davi-nails');
    expect(body.business.preferredReviewLabel).toBe('Yelp');
  });
});

describe('POST /api/public/review-survey/[slug]', () => {
  it('creates a 5-star notification and returns the review destination', async () => {
    mockCustomerFindFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'Andy Pham',
    });
    mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });

    const token = createReviewSurveyToken({
      s: 'davi-nails',
      c: 'cust-1',
      n: 'Andy Pham',
      e: Date.now() + 60_000,
    });

    const req = new NextRequest('http://localhost/api/public/review-survey/davi-nails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, token }),
    });
    const res = await POST(req, { params: Promise.resolve({ slug: 'davi-nails' }) });

    expect(res.status).toBe(200);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'review_feedback_5_star',
          title: 'New 5-star survey response',
          link: '/dashboard/customers/cust-1',
        }),
      })
    );

    const body = await res.json();
    expect(body.preferredReviewUrl).toBe('https://google.com/review');
    expect(body.preferredReviewLabel).toBe('Google');
  });

  it('returns no public review destination when stored review URLs are unsafe', async () => {
    mockBusinessFindUnique.mockResolvedValue({
      id: 'biz-1',
      name: 'Davi Nails',
      slug: 'davi-nails',
      publicId: 'CF-8QXLBD',
      logoUrl: null,
      googleReviewUrl: 'javascript:alert(1)',
      yelpUrl: 'data:text/html,<script>alert(1)</script>',
    });
    mockCustomerFindFirst.mockResolvedValue(null);
    mockNotificationCreate.mockResolvedValue({ id: 'notif-1' });

    const req = new NextRequest('http://localhost/api/public/review-survey/davi-nails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5 }),
    });
    const res = await POST(req, { params: Promise.resolve({ slug: 'davi-nails' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preferredReviewUrl).toBeNull();
    expect(body.preferredReviewLabel).toBeNull();
  });

  it('stores private feedback for lower ratings', async () => {
    mockCustomerFindFirst.mockResolvedValue(null);
    mockNotificationCreate.mockResolvedValue({ id: 'notif-2' });

    const token = createReviewSurveyToken({
      s: 'davi-nails',
      c: 'cust-1',
      n: 'Andy Pham',
      e: Date.now() + 60_000,
    });

    const req = new NextRequest('http://localhost/api/public/review-survey/davi-nails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: 3,
        feedback: 'The wait was too long.',
        token,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ slug: 'davi-nails' }) });

    expect(res.status).toBe(200);
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'review_feedback_private',
          title: 'New private customer feedback',
          message: expect.stringContaining('The wait was too long.'),
          link: '/dashboard/reviews',
        }),
      })
    );
  });
});
