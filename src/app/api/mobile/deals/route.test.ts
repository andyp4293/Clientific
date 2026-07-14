import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      create: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));

import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET, POST } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindDeals = prisma.deal.findMany as ReturnType<typeof vi.fn>;
const mockCreateDeal = prisma.deal.create as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('GET /api/mobile/deals', () => {
  it('returns deal summaries for the mobile workspace', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
        serviceScope: 'selected_services',
        discountType: 'percent_off',
        discountValue: 20,
        newCustomersOnly: false,
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        expiresAt: nextWeek,
        maxRedemptions: null,
        redemptionCount: 1,
        createdAt: tomorrow,
        eligibleServices: [{ id: 'svc-1', name: 'Gel manicure', price: 45 }],
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
      serviceScope: 'selected_services',
      eligibleServices: [{ id: 'svc-1', name: 'Gel manicure', price: 45 }],
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

describe('POST /api/mobile/deals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeRequest(body: Record<string, unknown>) {
    return new Request('https://www.clientific.app/api/mobile/deals', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  const validBody = {
    title: 'Summer gel special',
    description: 'Weekday manicure promo.',
    discountType: 'percent_off',
    discountValue: 20,
    serviceScope: 'selected_services',
    eligibleServiceIds: ['svc-1'],
    startsAt: '2026-07-14',
    expiresAt: '2026-07-21',
    maxRedemptions: 25,
  };

  it('creates a selected-service purchase-link deal for the signed-in owner', async () => {
    mockFindBusiness.mockResolvedValue({
      stripeConnectAccountId: 'acct_1',
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
    });
    mockFindServices.mockResolvedValue([{ id: 'svc-1' }]);
    mockCreateDeal.mockResolvedValue({
      id: 'deal-2',
      title: 'Summer gel special',
      description: 'Weekday manicure promo.',
      active: true,
      deliveryType: 'purchase_link',
      serviceScope: 'selected_services',
      discountType: 'percent_off',
      discountValue: 20,
      newCustomersOnly: false,
      startsAt: new Date('2026-07-14T00:00:00.000Z'),
      expiresAt: new Date('2026-07-21T23:59:59.999Z'),
      maxRedemptions: 25,
      redemptionCount: 0,
      eligibleServices: [{ id: 'svc-1', name: 'Gel manicure', price: 45 }],
    });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(201);
    expect(mockFindServices).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          id: { in: ['svc-1'] },
          active: true,
        }),
      }),
    );
    expect(mockCreateDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          title: 'Summer gel special',
          deliveryType: 'purchase_link',
          serviceScope: 'selected_services',
          eligibleServices: { connect: [{ id: 'svc-1' }] },
          maxRedemptions: 25,
        }),
      }),
    );
    expect((await response.json()).deal).toMatchObject({
      id: 'deal-2',
      title: 'Summer gel special',
      discountLabel: '20% off',
      linkPath: '/d/deal-2',
    });
  });

  it('rejects free-service deals unless exactly one service is selected', async () => {
    const response = await POST(
      makeRequest({
        ...validBody,
        discountType: 'free_service',
        discountValue: undefined,
        eligibleServiceIds: ['svc-1', 'svc-2'],
      }),
    );

    expect(response.status).toBe(400);
    expect(mockCreateDeal).not.toHaveBeenCalled();
    expect((await response.json()).error).toMatch(/exactly one service/i);
  });

  it('blocks publishing paid purchase-link deals before payouts are ready', async () => {
    mockFindServices.mockResolvedValue([{ id: 'svc-1' }]);
    mockFindBusiness.mockResolvedValue({
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
    });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(409);
    expect(mockCreateDeal).not.toHaveBeenCalled();
    expect((await response.json()).error).toMatch(/payout setup/i);
  });
});
