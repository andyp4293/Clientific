import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import {
  fetchRevenueCatSubscriber,
  buildRevenueCatAppUserId,
  getRevenueCatProductPlan,
  parseRevenueCatAppUserId,
  resolveRevenueCatEventSnapshot,
  resolveRevenueCatSubscriberSnapshot,
} from '@/lib/revenuecat';

const envSnapshot = {
  starter: process.env.REVENUECAT_STARTER_PRODUCT_ID,
  pro: process.env.REVENUECAT_PRO_PRODUCT_ID,
  premium: process.env.REVENUECAT_PREMIUM_PRODUCT_ID,
  revenueCatV1ApiKey: process.env.REVENUECAT_V1_API_KEY,
  revenueCatPublicIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  revenueCatSecretApiKey: process.env.REVENUECAT_SECRET_API_KEY,
};

beforeEach(() => {
  process.env.REVENUECAT_STARTER_PRODUCT_ID = 'clientific_starter_monthly';
  process.env.REVENUECAT_PRO_PRODUCT_ID = 'clientific_pro_monthly';
  process.env.REVENUECAT_PREMIUM_PRODUCT_ID = 'clientific_premium_monthly';
});

afterEach(() => {
  process.env.REVENUECAT_STARTER_PRODUCT_ID = envSnapshot.starter;
  process.env.REVENUECAT_PRO_PRODUCT_ID = envSnapshot.pro;
  process.env.REVENUECAT_PREMIUM_PRODUCT_ID = envSnapshot.premium;
  process.env.REVENUECAT_V1_API_KEY = envSnapshot.revenueCatV1ApiKey;
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = envSnapshot.revenueCatPublicIosApiKey;
  process.env.REVENUECAT_SECRET_API_KEY = envSnapshot.revenueCatSecretApiKey;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('RevenueCat helpers', () => {
  it('builds and parses deterministic business app user ids', () => {
    expect(buildRevenueCatAppUserId('biz_123')).toBe('business:biz_123');
    expect(parseRevenueCatAppUserId('business:biz_123')).toBe('biz_123');
    expect(parseRevenueCatAppUserId('customer:biz_123')).toBeNull();
  });

  it('maps configured App Store product ids to Clientific plans', () => {
    expect(getRevenueCatProductPlan('clientific_starter_monthly')).toBe('starter');
    expect(getRevenueCatProductPlan('clientific_pro_monthly')).toBe('pro');
    expect(getRevenueCatProductPlan('clientific_premium_monthly')).toBe('premium');
  });

  it('falls back to product id keywords when explicit env ids are absent', () => {
    delete process.env.REVENUECAT_STARTER_PRODUCT_ID;
    delete process.env.REVENUECAT_PRO_PRODUCT_ID;
    delete process.env.REVENUECAT_PREMIUM_PRODUCT_ID;

    expect(getRevenueCatProductPlan('com.clientific.starter.monthly')).toBe('starter');
    expect(getRevenueCatProductPlan('com.clientific.pro.monthly')).toBe('pro');
    expect(getRevenueCatProductPlan('com.clientific.premium.monthly')).toBe('premium');
  });

  it('resolves a trialing subscriber snapshot from active RevenueCat data', () => {
    const snapshot = resolveRevenueCatSubscriberSnapshot(
      {
        subscriptions: {
          clientific_pro_monthly: {
            expires_date: '2026-05-01T00:00:00.000Z',
            period_type: 'trial',
            original_transaction_id: 'orig_123',
            is_sandbox: true,
          },
        },
      },
      new Date('2026-04-17T00:00:00.000Z'),
    );

    expect(snapshot).toMatchObject({
      billingProvider: 'app_store',
      plan: 'pro',
      subscriptionStatus: 'trialing',
      productId: 'clientific_pro_monthly',
      originalTransactionId: 'orig_123',
      environment: 'Sandbox',
    });
    expect(snapshot?.trialEndsAt?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('resolves a grace period subscriber snapshot when billing issues are present', () => {
    const snapshot = resolveRevenueCatSubscriberSnapshot(
      {
        subscriptions: {
          clientific_premium_monthly: {
            expires_date: '2026-05-01T00:00:00.000Z',
            period_type: 'normal',
            billing_issues_detected_at: '2026-04-16T00:00:00.000Z',
            original_transaction_id: 'orig_999',
            is_sandbox: false,
          },
        },
      },
      new Date('2026-04-17T00:00:00.000Z'),
    );

    expect(snapshot).toMatchObject({
      plan: 'premium',
      subscriptionStatus: 'grace_period',
      environment: 'Production',
    });
  });

  it('resolves webhook snapshots for cancellations and expirations', () => {
    const canceled = resolveRevenueCatEventSnapshot(
      {
        id: 'evt_1',
        type: 'CANCELLATION',
        product_id: 'clientific_starter_monthly',
        original_transaction_id: 'orig_1',
        expiration_at_ms: Date.parse('2026-05-10T00:00:00.000Z'),
        environment: 'Production',
      },
      new Date('2026-04-17T00:00:00.000Z'),
    );

    const expired = resolveRevenueCatEventSnapshot(
      {
        id: 'evt_2',
        type: 'EXPIRATION',
        product_id: 'clientific_starter_monthly',
        original_transaction_id: 'orig_1',
        expiration_at_ms: Date.parse('2026-04-10T00:00:00.000Z'),
        environment: 'Production',
      },
      new Date('2026-04-17T00:00:00.000Z'),
    );

    expect(canceled).toMatchObject({
      plan: 'starter',
      subscriptionStatus: 'active',
    });
    expect(expired).toMatchObject({
      plan: 'starter',
      subscriptionStatus: 'canceled',
    });
  });

  it('uses the RevenueCat v1 lookup key for subscriber fetches when configured', async () => {
    process.env.REVENUECAT_V1_API_KEY = 'appl_v1_lookup_key';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'appl_public_key';
    process.env.REVENUECAT_SECRET_API_KEY = 'sk_secret_key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscriber: {
          subscriptions: {},
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    await fetchRevenueCatSubscriber('business:biz_123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/business%3Abiz_123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer appl_v1_lookup_key',
          'X-Platform': 'ios',
        }),
      }),
    );
  });
});
