import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindDeals = prisma.deal.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('GET /api/mobile/deals', () => {
  it('returns deal summaries for the mobile workspace', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      name: 'Clientific Studio',
      email: 'owner@clientific.app',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      stripeConnectAccountId: 'acct_1',
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
    });
    mockFindDeals.mockResolvedValue([
      {
        id: 'deal-1',
        title: 'Spring Special',
        description: 'Bring in new clients this week.',
        active: true,
        deliveryType: 'purchase_link',
        discountType: 'percent_off',
        discountValue: 20,
        startsAt: new Date('2026-03-28T00:00:00.000Z'),
        expiresAt: new Date('2026-04-04T00:00:00.000Z'),
        maxRedemptions: null,
        redemptionCount: 1,
        createdAt: new Date('2026-03-27T00:00:00.000Z'),
        purchases: [
          { id: 'purchase-1', totalAmount: 2500 },
          { id: 'purchase-2', totalAmount: 2500 },
        ],
        redemptions: [{ id: 'redemption-1', transactionAmount: 45 }],
      },
    ]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/deals', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.payoutReady).toBe(true);
    expect(body.counts.total).toBe(1);
    expect(body.counts.live).toBe(1);
    expect(body.deals[0]).toMatchObject({
      id: 'deal-1',
      title: 'Spring Special',
      discountLabel: '20% off',
      deliveryLabel: 'Purchase link',
      purchasesCount: 2,
      redemptionsCount: 1,
      revenueLabel: '$95.00',
      statusLabel: 'Live',
      statusTone: 'live',
      linkPath: '/d/deal-1',
    });
  });

  it('returns a setup message when payouts are not ready', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      name: 'Clientific Studio',
      email: 'owner@clientific.app',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
    });
    mockFindDeals.mockResolvedValue([]);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/deals', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.payoutReady).toBe(false);
    expect(body.payoutSetupMessage).toMatch(/payout setup/i);
    expect(body.deals).toEqual([]);
  });
});
