import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing subscription
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock stripe to prevent real Stripe client init
vi.mock('@/lib/stripe', () => ({
  stripe: {},
  PRICING_PLANS: {
    TRIAL: { name: 'Trial', limits: { customers: 0, staff: 0, services: 0, directMessages: 0 } },
    STARTER: { name: 'Starter', limits: { customers: 100, staff: 10, services: 10, directMessages: 25 } },
    PRO: { name: 'Pro', limits: { customers: 1000, staff: 50, services: 50, directMessages: 100 } },
    PREMIUM: { name: 'Premium', limits: { customers: Infinity, staff: Infinity, services: Infinity, directMessages: 500 } },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  hasActiveSubscription,
  requireActiveSubscription,
  checkPlanLimit,
  getSubscriptionInfo,
} from '@/lib/subscription';

const mockFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── hasActiveSubscription ──────────────────────────────────────────────────

describe('hasActiveSubscription', () => {
  it('returns false when business not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await hasActiveSubscription('biz-1')).toBe(false);
  });

  it('returns true when status is active', async () => {
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'active', trialEndsAt: null });
    expect(await hasActiveSubscription('biz-1')).toBe(true);
  });

  it('returns true when trialing and trial end is in the future', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'trialing', trialEndsAt: future });
    expect(await hasActiveSubscription('biz-1')).toBe(true);
  });

  it('returns false when trialing and trial end is in the past', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'trialing', trialEndsAt: past });
    expect(await hasActiveSubscription('biz-1')).toBe(false);
  });

  it('returns false when trialing and trialEndsAt is null', async () => {
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'trialing', trialEndsAt: null });
    expect(await hasActiveSubscription('biz-1')).toBe(false);
  });

  it('returns false when status is past_due', async () => {
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'past_due', trialEndsAt: null });
    expect(await hasActiveSubscription('biz-1')).toBe(false);
  });

  it('returns false when status is canceled', async () => {
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'canceled', trialEndsAt: null });
    expect(await hasActiveSubscription('biz-1')).toBe(false);
  });

  it('returns false when status is incomplete', async () => {
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'incomplete', trialEndsAt: null });
    expect(await hasActiveSubscription('biz-1')).toBe(false);
  });
});

// ── requireActiveSubscription ─────────────────────────────────────────────

describe('requireActiveSubscription', () => {
  it('returns null when subscription is active', async () => {
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'active', trialEndsAt: null });
    const result = await requireActiveSubscription('biz-1');
    expect(result).toBeNull();
  });

  it('returns 403 NextResponse when subscription is inactive', async () => {
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'canceled', trialEndsAt: null });
    const result = await requireActiveSubscription('biz-1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 403 when trial is expired', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({ subscriptionStatus: 'trialing', trialEndsAt: past });
    const result = await requireActiveSubscription('biz-1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

// ── checkPlanLimit ────────────────────────────────────────────────────────

describe('checkPlanLimit', () => {
  it('returns allowed: true for starter plan under 100 customers', async () => {
    mockFindUnique.mockResolvedValue({
      subscriptionPlan: 'starter',
      _count: { customers: 50, staff: 0, services: 0 },
    });
    const result = await checkPlanLimit('biz-1', 'customers');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(50);
    expect(result.limit).toBe(100);
  });

  it('returns allowed: false for starter plan at 100 customers', async () => {
    mockFindUnique.mockResolvedValue({
      subscriptionPlan: 'starter',
      _count: { customers: 100, staff: 0, services: 0 },
    });
    const result = await checkPlanLimit('biz-1', 'customers');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(100);
  });

  it('returns allowed: true for premium plan (Infinity limit)', async () => {
    mockFindUnique.mockResolvedValue({
      subscriptionPlan: 'premium',
      _count: { customers: 99999, staff: 0, services: 0 },
    });
    const result = await checkPlanLimit('biz-1', 'customers');
    expect(result.allowed).toBe(true);
  });

  it('returns allowed: false when business not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await checkPlanLimit('biz-1', 'customers');
    expect(result.allowed).toBe(false);
  });

  it('returns allowed: true for starter plan under 10 staff profiles', async () => {
    mockFindUnique.mockResolvedValue({
      subscriptionPlan: 'starter',
      _count: { customers: 0, staff: 9, services: 0 },
    });
    const result = await checkPlanLimit('biz-1', 'staff');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(9);
    expect(result.limit).toBe(10);
  });

  it('returns allowed: false for starter plan at 10 staff profiles', async () => {
    mockFindUnique.mockResolvedValue({
      subscriptionPlan: 'starter',
      _count: { customers: 0, staff: 10, services: 0 },
    });
    const result = await checkPlanLimit('biz-1', 'staff');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(10);
    expect(result.limit).toBe(10);
  });

  it('returns allowed: true for pro plan under 50 staff profiles', async () => {
    mockFindUnique.mockResolvedValue({
      subscriptionPlan: 'pro',
      _count: { customers: 0, staff: 49, services: 0 },
    });
    const result = await checkPlanLimit('biz-1', 'staff');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(49);
    expect(result.limit).toBe(50);
  });

  it('returns allowed: false for pro plan at 50 staff profiles', async () => {
    mockFindUnique.mockResolvedValue({
      subscriptionPlan: 'pro',
      _count: { customers: 0, staff: 50, services: 0 },
    });
    const result = await checkPlanLimit('biz-1', 'staff');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(50);
    expect(result.limit).toBe(50);
  });

  it('returns allowed: true for premium plan staff regardless of size', async () => {
    mockFindUnique.mockResolvedValue({
      subscriptionPlan: 'premium',
      _count: { customers: 0, staff: 9999, services: 0 },
    });
    const result = await checkPlanLimit('biz-1', 'staff');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Infinity);
  });
});

describe('getSubscriptionInfo', () => {
  it('normalizes existing web accounts to the stripe billing provider', async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        subscriptionPlan: 'starter',
        subscriptionStatus: 'active',
        billingProvider: null,
        trialEndsAt: null,
        subscriptionCurrentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        stripeCurrentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        appStoreOriginalTransactionId: null,
        appStoreProductId: null,
        appStoreEnvironment: null,
        appStoreLastVerifiedAt: null,
      })
      .mockResolvedValueOnce({
        subscriptionStatus: 'active',
        trialEndsAt: null,
      })
      .mockResolvedValueOnce({
        subscriptionStatus: 'active',
        trialEndsAt: null,
      });

    const result = await getSubscriptionInfo('biz-1');

    expect(result?.billingProvider).toBe('stripe');
    expect(result?.subscriptionCurrentPeriodEnd).toEqual(
      new Date('2026-05-01T00:00:00.000Z'),
    );
    expect(result?.isActive).toBe(true);
  });

  it('preserves app store metadata when that provider is already set', async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        subscriptionPlan: 'pro',
        subscriptionStatus: 'active',
        billingProvider: 'app_store',
        trialEndsAt: null,
        subscriptionCurrentPeriodEnd: new Date('2026-05-20T00:00:00.000Z'),
        stripeCurrentPeriodEnd: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        appStoreOriginalTransactionId: '10000009999',
        appStoreProductId: 'clientific.pro.monthly',
        appStoreEnvironment: 'Sandbox',
        appStoreLastVerifiedAt: new Date('2026-04-17T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        subscriptionStatus: 'active',
        trialEndsAt: null,
      })
      .mockResolvedValueOnce({
        subscriptionStatus: 'active',
        trialEndsAt: null,
      });

    const result = await getSubscriptionInfo('biz-1');

    expect(result?.billingProvider).toBe('app_store');
    expect(result?.appStoreProductId).toBe('clientific.pro.monthly');
    expect(result?.appStoreOriginalTransactionId).toBe('10000009999');
  });
});
