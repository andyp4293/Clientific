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
    dealPurchase: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.dealPurchase.findUnique as ReturnType<typeof vi.fn>;

describe('GET /api/public/deal-purchases/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue({
      id: 'purchase-1',
      token: 'tok_123',
      businessId: 'biz-1',
      status: 'paid',
      customerName: 'Jane Doe',
      customerPhone: '(555) 123-4567',
      customerEmail: 'jane@example.com',
      subtotalAmount: 10000,
      discountAmount: 2000,
      totalAmount: 8000,
      applicationFeeAmount: 1200,
      businessNetAmount: 6800,
      stripeReceiptUrl: 'https://stripe.test/receipt',
      redemptionCode: 'SAVE20',
      purchasedAt: '2026-03-19T12:00:00.000Z',
      redeemedAt: null,
      expiresAt: '2026-04-30T00:00:00.000Z',
      smsConfirmationSentAt: null,
      deal: {
        id: 'deal-1',
        title: 'Spring Glow Package',
        description: 'A polished premium package.',
        discountType: 'percent_off',
        discountValue: 20,
        expiresAt: '2026-04-30T00:00:00.000Z',
      },
      business: {
        name: 'Test Salon',
        slug: 'test-salon',
        publicId: 'pub-1',
        city: 'Austin',
        state: 'TX',
      },
      items: [],
    });
  });

  it('marks viewerCanManage false for public visitors', async () => {
    const req = new NextRequest('http://localhost/api/public/deal-purchases/tok_123');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok_123' }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      viewerCanManage: false,
      purchase: {
        id: 'purchase-1',
      },
    });
  });

  it('marks viewerCanManage true for the owning business session', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
        businessId: 'biz-1',
      },
    });

    const req = new NextRequest('http://localhost/api/public/deal-purchases/tok_123');
    const res = await GET(req, { params: Promise.resolve({ token: 'tok_123' }) });

    await expect(res.json()).resolves.toMatchObject({
      viewerCanManage: true,
    });
  });
});
