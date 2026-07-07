import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));

vi.mock('@/lib/revenuecat', () => ({
  applyRevenueCatSubscriptionSnapshot: vi.fn(),
  buildRevenueCatAppUserId: vi.fn((businessId: string) => `business:${businessId}`),
  fetchRevenueCatSubscriber: vi.fn(),
  resolveRevenueCatSubscriberSnapshot: vi.fn(),
}));

import { requireMobileSession } from '@/lib/mobile-route';
import {
  applyRevenueCatSubscriptionSnapshot,
  fetchRevenueCatSubscriber,
  resolveRevenueCatSubscriberSnapshot,
} from '@/lib/revenuecat';
import { POST } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFetchRevenueCatSubscriber = fetchRevenueCatSubscriber as ReturnType<typeof vi.fn>;
const mockResolveRevenueCatSubscriberSnapshot =
  resolveRevenueCatSubscriberSnapshot as ReturnType<typeof vi.fn>;
const mockApplyRevenueCatSubscriptionSnapshot =
  applyRevenueCatSubscriptionSnapshot as ReturnType<typeof vi.fn>;

const activeSubscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const snapshot = {
  billingProvider: 'app_store' as const,
  plan: 'pro' as const,
  subscriptionStatus: 'trialing' as const,
  trialEndsAt: activeSubscriptionEnd,
  subscriptionCurrentPeriodEnd: activeSubscriptionEnd,
  productId: 'clientific_pro_monthly',
  originalTransactionId: 'orig_123',
  environment: 'Sandbox',
  lastVerifiedAt: new Date('2026-05-04T00:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({
    session: { businessId: 'biz-1' },
  });
  mockFetchRevenueCatSubscriber.mockResolvedValue({ subscriptions: {} });
  mockResolveRevenueCatSubscriberSnapshot.mockReturnValue(snapshot);
  mockApplyRevenueCatSubscriptionSnapshot.mockResolvedValue({
    applied: true,
    conflict: false,
    ownershipConflict: false,
    businessId: 'biz-1',
    snapshot,
  });
});

describe('POST /api/mobile/billing/sync-app-store', () => {
  it('syncs a successful App Store purchase for the signed-in business', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/billing/sync-app-store', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appUserId: 'business:biz-1' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockFetchRevenueCatSubscriber).toHaveBeenCalledWith('business:biz-1');
    expect(mockApplyRevenueCatSubscriptionSnapshot).toHaveBeenCalledWith({
      businessId: 'biz-1',
      snapshot,
    });
    expect(await response.json()).toEqual(
      expect.objectContaining({
        success: true,
        subscription: expect.objectContaining({
          plan: 'pro',
          subscriptionStatus: 'trialing',
          billingProvider: 'app_store',
          isActive: true,
        }),
      }),
    );
  });

  it('accepts introductory-trial snapshots and preserves the trial period end', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/billing/sync-app-store', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.subscription.trialEndsAt).toBe(activeSubscriptionEnd.toISOString());
    expect(body.subscription.subscriptionCurrentPeriodEnd).toBe(
      activeSubscriptionEnd.toISOString(),
    );
  });

  it('rejects mismatched RevenueCat app user ids', async () => {
    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/billing/sync-app-store', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appUserId: 'business:other-biz' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'APP_STORE_APP_USER_ID_MISMATCH' }),
    );
  });

  it('returns a missing-entitlement response when RevenueCat has nothing to sync', async () => {
    mockResolveRevenueCatSubscriberSnapshot.mockReturnValue(null);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/billing/sync-app-store', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'APP_STORE_SUBSCRIPTION_NOT_FOUND' }),
    );
  });

  it('retries RevenueCat lookup before failing when sandbox entitlements are delayed', async () => {
    mockResolveRevenueCatSubscriberSnapshot
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValue(snapshot);

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/billing/sync-app-store', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(mockFetchRevenueCatSubscriber).toHaveBeenCalledTimes(3);
    expect(mockResolveRevenueCatSubscriberSnapshot).toHaveBeenCalledTimes(3);
  });

  it('surfaces ownership conflicts for restores tied to another business', async () => {
    mockApplyRevenueCatSubscriptionSnapshot.mockResolvedValue({
      applied: false,
      conflict: false,
      ownershipConflict: true,
      businessId: 'biz-1',
      ownerBusinessId: 'biz-2',
      snapshot,
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/billing/sync-app-store', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        code: 'APP_STORE_SUBSCRIPTION_OWNERSHIP_CONFLICT',
        ownerBusinessId: 'biz-2',
      }),
    );
  });

  it('flags unexpected duplicate App Store purchases for active Stripe businesses', async () => {
    mockApplyRevenueCatSubscriptionSnapshot.mockResolvedValue({
      applied: false,
      conflict: true,
      ownershipConflict: false,
      businessId: 'biz-1',
      snapshot,
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/billing/sync-app-store', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: 'APP_STORE_SUBSCRIPTION_CONFLICT' }),
    );
  });

  it('returns the mobile auth error when the session is missing', async () => {
    mockRequireMobileSession.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const response = await POST(
      new Request('https://www.clientific.app/api/mobile/billing/sync-app-store', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
  });
});
