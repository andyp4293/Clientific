import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    revenueCatWebhookEvent: {
      create: vi.fn(),
      update: vi.fn(),
    },
    business: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/revenuecat', () => ({
  applyRevenueCatSubscriptionSnapshot: vi.fn(),
  parseRevenueCatAppUserId: vi.fn((value: string | null | undefined) =>
    value?.startsWith('business:') ? value.replace('business:', '') : null,
  ),
  resolveRevenueCatEventSnapshot: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import {
  applyRevenueCatSubscriptionSnapshot,
  resolveRevenueCatEventSnapshot,
} from '@/lib/revenuecat';
import { POST } from './route';

const mockCreateWebhookEvent = prisma.revenueCatWebhookEvent.create as ReturnType<typeof vi.fn>;
const mockUpdateWebhookEvent = prisma.revenueCatWebhookEvent.update as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockResolveRevenueCatEventSnapshot =
  resolveRevenueCatEventSnapshot as ReturnType<typeof vi.fn>;
const mockApplyRevenueCatSubscriptionSnapshot =
  applyRevenueCatSubscriptionSnapshot as ReturnType<typeof vi.fn>;

const snapshot = {
  billingProvider: 'app_store' as const,
  plan: 'starter' as const,
  subscriptionStatus: 'active' as const,
  trialEndsAt: null,
  subscriptionCurrentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
  productId: 'clientific_starter_monthly',
  originalTransactionId: 'orig_123',
  environment: 'Production',
  lastVerifiedAt: new Date('2026-04-17T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN = 'secret-token';
  mockCreateWebhookEvent.mockResolvedValue({});
  mockUpdateWebhookEvent.mockResolvedValue({});
  mockFindBusiness.mockResolvedValue(null);
  mockResolveRevenueCatEventSnapshot.mockReturnValue(snapshot);
  mockApplyRevenueCatSubscriptionSnapshot.mockResolvedValue({
    applied: true,
    conflict: false,
    ownershipConflict: false,
    businessId: 'biz-1',
    snapshot,
  });
});

describe('POST /api/webhooks/revenuecat', () => {
  it('requires the configured webhook bearer token', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/webhooks/revenuecat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: { id: 'evt-1', type: 'INITIAL_PURCHASE' } }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it('records and applies a successful purchase webhook', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          event: {
            id: 'evt-1',
            type: 'INITIAL_PURCHASE',
            app_user_id: 'business:biz-1',
            product_id: 'clientific_starter_monthly',
            original_transaction_id: 'orig_123',
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockCreateWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'evt-1',
          appUserId: 'business:biz-1',
          eventType: 'INITIAL_PURCHASE',
        }),
      }),
    );
    expect(mockApplyRevenueCatSubscriptionSnapshot).toHaveBeenCalledWith({
      businessId: 'biz-1',
      snapshot,
    });
    expect(mockUpdateWebhookEvent).toHaveBeenCalledWith({
      where: { eventId: 'evt-1' },
      data: { businessId: 'biz-1' },
    });
  });

  it('returns duplicate=true when RevenueCat retries the same event id', async () => {
    mockCreateWebhookEvent.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const response = await POST(
      new Request('https://www.clientific.app/api/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ event: { id: 'evt-1', type: 'RENEWAL' } }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, duplicate: true });
  });

  it('returns ignored when the event does not map to a supported plan snapshot', async () => {
    mockResolveRevenueCatEventSnapshot.mockReturnValue(null);

    const response = await POST(
      new Request('https://www.clientific.app/api/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ event: { id: 'evt-2', type: 'TEST' } }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, ignored: true });
  });

  it('returns ownershipConflict when a restore belongs to a different business', async () => {
    mockApplyRevenueCatSubscriptionSnapshot.mockResolvedValue({
      applied: false,
      conflict: false,
      ownershipConflict: true,
      businessId: 'biz-1',
      ownerBusinessId: 'biz-2',
      snapshot,
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          event: {
            id: 'evt-3',
            type: 'TRANSFER',
            app_user_id: 'business:biz-1',
            product_id: 'clientific_starter_monthly',
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      ownershipConflict: true,
      ownerBusinessId: 'biz-2',
    });
  });

  it('returns conflict=true when an active Stripe business receives an App Store event', async () => {
    mockApplyRevenueCatSubscriptionSnapshot.mockResolvedValue({
      applied: false,
      conflict: true,
      ownershipConflict: false,
      businessId: 'biz-1',
      snapshot,
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          event: {
            id: 'evt-4',
            type: 'INITIAL_PURCHASE',
            app_user_id: 'business:biz-1',
            product_id: 'clientific_starter_monthly',
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, conflict: true });
  });
});
