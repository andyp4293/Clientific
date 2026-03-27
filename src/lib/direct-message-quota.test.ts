import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
    smsLog: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/stripe', () => ({
  PRICING_PLANS: {
    STARTER: { limits: { directMessages: 25 } },
    PRO: { limits: { directMessages: 100 } },
    PREMIUM: { limits: { directMessages: 500 } },
  },
}));

import {
  buildDirectMessageQuotaSnapshot,
  getDirectMessagePlanLimit,
  getDirectMessageQuotaWindow,
} from './direct-message-quota';

function buildBusiness(overrides: Partial<{
  id: string;
  createdAt: Date;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  stripeCurrentPeriodEnd: Date | null;
}> = {}) {
  return {
    id: 'biz-1',
    createdAt: new Date('2026-03-10T15:00:00.000Z'),
    subscriptionPlan: 'starter',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date('2026-04-10T15:00:00.000Z'),
    stripeCurrentPeriodEnd: null,
    ...overrides,
  };
}

describe('direct-message quota helpers', () => {
  it('returns the correct direct message plan limits', () => {
    expect(getDirectMessagePlanLimit('starter')).toBe(25);
    expect(getDirectMessagePlanLimit('pro')).toBe(100);
    expect(getDirectMessagePlanLimit('premium')).toBe(500);
    expect(getDirectMessagePlanLimit('unknown')).toBe(25);
  });

  it('uses the Stripe billing window for active subscriptions with a current period end', () => {
    const { periodStart, periodEnd } = getDirectMessageQuotaWindow(
      buildBusiness({
        subscriptionPlan: 'pro',
        subscriptionStatus: 'active',
        stripeCurrentPeriodEnd: new Date('2026-05-15T12:00:00.000Z'),
      }),
      new Date('2026-04-20T12:00:00.000Z'),
    );

    expect(periodStart.toISOString()).toBe('2026-04-15T12:00:00.000Z');
    expect(periodEnd.toISOString()).toBe('2026-05-15T12:00:00.000Z');
  });

  it('falls back to a monthly anniversary window for trial and manual accounts', () => {
    const { periodStart, periodEnd } = getDirectMessageQuotaWindow(
      buildBusiness(),
      new Date('2026-05-27T18:00:00.000Z'),
    );

    expect(periodStart.toISOString()).toBe('2026-05-10T15:00:00.000Z');
    expect(periodEnd.toISOString()).toBe('2026-06-10T15:00:00.000Z');
  });

  it('builds an active starter snapshot with the right remaining count', () => {
    const snapshot = buildDirectMessageQuotaSnapshot(
      buildBusiness(),
      7,
      new Date('2026-03-20T10:00:00.000Z'),
    );

    expect(snapshot.limit).toBe(25);
    expect(snapshot.used).toBe(7);
    expect(snapshot.remaining).toBe(18);
    expect(snapshot.isActive).toBe(true);
  });

  it('marks the quota snapshot inactive when the trial has expired', () => {
    const snapshot = buildDirectMessageQuotaSnapshot(
      buildBusiness({
        trialEndsAt: new Date('2026-03-15T15:00:00.000Z'),
      }),
      3,
      new Date('2026-03-20T10:00:00.000Z'),
    );

    expect(snapshot.isActive).toBe(false);
    expect(snapshot.limit).toBe(25);
  });

  it('uses the larger premium limit without treating it as unlimited', () => {
    const snapshot = buildDirectMessageQuotaSnapshot(
      buildBusiness({
        subscriptionPlan: 'premium',
        subscriptionStatus: 'active',
        trialEndsAt: null,
        stripeCurrentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
      }),
      312,
      new Date('2026-05-20T10:00:00.000Z'),
    );

    expect(snapshot.limit).toBe(500);
    expect(snapshot.remaining).toBe(188);
  });
});
