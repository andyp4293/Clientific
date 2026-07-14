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
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
import { DELETE, PATCH } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockFindDeal = prisma.deal.findFirst as ReturnType<typeof vi.fn>;
const mockUpdateDeal = prisma.deal.update as ReturnType<typeof vi.fn>;
const mockDeleteDeal = prisma.deal.delete as ReturnType<typeof vi.fn>;
const mockFindServices = prisma.service.findMany as ReturnType<typeof vi.fn>;

const existingDeal = {
  id: 'deal-1',
  businessId: 'biz-1',
  title: 'Spring Special',
  description: 'Existing promo.',
  active: true,
  deliveryType: 'purchase_link',
  serviceScope: 'all_services',
  discountType: 'percent_off',
  discountValue: 20,
  newCustomersOnly: false,
  startsAt: new Date('2026-07-14T00:00:00.000Z'),
  expiresAt: new Date('2026-07-21T23:59:59.999Z'),
  maxRedemptions: null,
  redemptionCount: 0,
  eligibleServices: [],
};

function patchRequest(body: Record<string, unknown>) {
  return new Request('https://www.clientific.app/api/mobile/deals/deal-1', {
    method: 'PATCH',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new Request('https://www.clientific.app/api/mobile/deals/deal-1', {
    method: 'DELETE',
    headers: { authorization: 'Bearer token' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
  mockFindDeal.mockResolvedValue(existingDeal);
  mockUpdateDeal.mockResolvedValue(existingDeal);
});

describe('PATCH /api/mobile/deals/[id]', () => {
  it('pauses an owned deal without touching customers or sending messages', async () => {
    mockUpdateDeal.mockResolvedValue({
      ...existingDeal,
      active: false,
    });

    const response = await PATCH(patchRequest({ active: false }), {
      params: Promise.resolve({ id: 'deal-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockUpdateDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'deal-1' },
        data: { active: false },
      }),
    );
    expect((await response.json()).deal).toMatchObject({
      id: 'deal-1',
      active: false,
      statusLabel: 'Draft',
    });
  });

  it('updates selected-service targeting with only active services owned by the business', async () => {
    mockFindServices.mockResolvedValue([{ id: 'svc-1' }]);
    mockUpdateDeal.mockResolvedValue({
      ...existingDeal,
      serviceScope: 'selected_services',
      eligibleServices: [{ id: 'svc-1', name: 'Gel manicure', price: 45 }],
    });

    const response = await PATCH(
      patchRequest({
        serviceScope: 'selected_services',
        eligibleServiceIds: ['svc-1'],
      }),
      { params: Promise.resolve({ id: 'deal-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockFindServices).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'biz-1',
          id: { in: ['svc-1'] },
          active: true,
        }),
      }),
    );
    expect(mockUpdateDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceScope: 'selected_services',
          eligibleServices: { set: [{ id: 'svc-1' }] },
        }),
      }),
    );
  });

  it('blocks publishing a paid deal when payout setup is incomplete', async () => {
    mockFindDeal.mockResolvedValue({
      ...existingDeal,
      active: false,
    });
    mockFindBusiness.mockResolvedValue({
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
    });

    const response = await PATCH(patchRequest({ active: true }), {
      params: Promise.resolve({ id: 'deal-1' }),
    });

    expect(response.status).toBe(409);
    expect(mockUpdateDeal).not.toHaveBeenCalled();
    expect((await response.json()).error).toMatch(/payout setup/i);
  });
});

describe('DELETE /api/mobile/deals/[id]', () => {
  it('deletes an owned deal through the mobile token route', async () => {
    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: 'deal-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockDeleteDeal).toHaveBeenCalledWith({ where: { id: 'deal-1' } });
    expect(await response.json()).toEqual({ success: true });
  });
});
