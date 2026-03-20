import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dealPurchase: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockFindUnique = prisma.dealPurchase.findUnique as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new NextRequest('http://localhost/api/public/deal-purchases/token-1');
}

function makeParams(token = 'token-1') {
  return { params: Promise.resolve({ token }) };
}

const purchaseFixture = {
  id: 'purchase-1',
  token: 'token-1',
  status: 'paid',
  customerName: 'Jane Doe',
  customerPhone: '+15551234567',
  customerEmail: 'jane@example.com',
  subtotalAmount: 5000,
  discountAmount: 1000,
  totalAmount: 4000,
  applicationFeeAmount: 600,
  businessNetAmount: 3400,
  stripeReceiptUrl: 'https://pay.stripe.com/receipts/example',
  redemptionCode: 'ABCD1234',
  purchasedAt: new Date('2026-03-10T10:00:00Z'),
  redeemedAt: null,
  expiresAt: new Date('2026-04-10T10:00:00Z'),
  smsConfirmationSentAt: new Date('2026-03-10T10:01:00Z'),
  deal: {
    id: 'deal-1',
    title: 'Spring Offer',
    description: 'Save on your next visit',
    discountType: 'percent_off',
    discountValue: 20,
    expiresAt: new Date('2026-04-10T10:00:00Z'),
  },
  business: {
    name: 'Test Salon',
    slug: 'test-salon',
    publicId: 'pub-1',
    city: 'Austin',
    state: 'TX',
  },
  items: [
    {
      id: 'item-1',
      serviceName: 'Gel Manicure',
      quantity: 1,
      originalUnitAmount: 5000,
      discountedUnitAmount: 4000,
    },
  ],
};

describe('GET /api/public/deal-purchases/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when the purchase token is unknown', async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(404);
  });

  it('returns the receipt payload for a valid token', async () => {
    mockFindUnique.mockResolvedValue(purchaseFixture);

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      purchase: {
        id: 'purchase-1',
        token: 'token-1',
        customerName: 'Jane Doe',
        totalAmount: 4000,
        business: {
          name: 'Test Salon',
        },
        items: [
          {
            serviceName: 'Gel Manicure',
          },
        ],
      },
    });
  });

  it('returns 500 when the database lookup throws', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB down'));

    const res = await GET(makeRequest(), makeParams());

    expect(res.status).toBe(500);
  });
});
