import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBusinessFindMany,
  mockBusinessFindUnique,
  mockTrialReminderCreate,
  mockTrialReminderDelete,
  mockSendTrialEndingReminderEmail,
} = vi.hoisted(() => ({
  mockBusinessFindMany: vi.fn(),
  mockBusinessFindUnique: vi.fn(),
  mockTrialReminderCreate: vi.fn(),
  mockTrialReminderDelete: vi.fn(),
  mockSendTrialEndingReminderEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findMany: mockBusinessFindMany,
      findUnique: mockBusinessFindUnique,
    },
    trialReminderNotice: {
      create: mockTrialReminderCreate,
      delete: mockTrialReminderDelete,
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendTrialEndingReminderEmail: mockSendTrialEndingReminderEmail,
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://clientific.app'),
}));

vi.mock('@/lib/stripe', () => ({
  PRICING_PLANS: {
    STARTER: { name: 'Starter', price: 39 },
    PRO: { name: 'Pro', price: 69 },
    PREMIUM: { name: 'Premium', price: 99 },
  },
}));

import {
  sendDueTrialEndingReminders,
  sendStripeTrialWillEndReminder,
  sendTrialReminderForBusiness,
} from './trial-reminders';

const baseBusiness = {
  id: 'biz-1',
  email: 'owner@example.com',
  name: 'Test Salon',
  subscriptionPlan: 'pro',
  subscriptionStatus: 'trialing',
  billingProvider: 'stripe',
  trialEndsAt: new Date('2026-06-08T13:00:00.000Z'),
  stripeSubscriptionId: 'sub_123',
  stripePriceId: 'price_pro',
};

describe('trial reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBusinessFindMany.mockResolvedValue([]);
    mockBusinessFindUnique.mockResolvedValue(null);
    mockTrialReminderCreate.mockResolvedValue({ id: 'notice-1' });
    mockTrialReminderDelete.mockResolvedValue({});
    mockSendTrialEndingReminderEmail.mockResolvedValue(undefined);
  });

  it('sends due 7-day and 1-day Stripe trial reminders with exact auto-renewal terms', async () => {
    mockBusinessFindMany
      .mockResolvedValueOnce([
        {
          ...baseBusiness,
          id: 'biz-7',
          trialEndsAt: new Date('2026-06-08T13:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          ...baseBusiness,
          id: 'biz-1',
          trialEndsAt: new Date('2026-06-02T13:00:00.000Z'),
        },
      ]);
    mockTrialReminderCreate
      .mockResolvedValueOnce({ id: 'notice-7' })
      .mockResolvedValueOnce({ id: 'notice-1' });

    const summary = await sendDueTrialEndingReminders({
      now: new Date('2026-06-01T12:00:00.000Z'),
    });

    expect(summary).toEqual({
      checkedCount: 2,
      sentCount: 2,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(mockBusinessFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          billingProvider: 'stripe',
          subscriptionStatus: 'trialing',
          stripeSubscriptionId: { not: null },
          trialEndsAt: {
            gte: new Date('2026-06-08T12:00:00.000Z'),
            lt: new Date('2026-06-09T12:00:00.000Z'),
          },
        }),
      }),
    );
    expect(mockTrialReminderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-7',
          noticeType: 'trial_ends_in_7_days',
          source: 'cron',
        }),
      }),
    );
    expect(mockSendTrialEndingReminderEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'owner@example.com',
        businessName: 'Test Salon',
        planName: 'Pro',
        priceLabel: '$69/month',
        reminderLabel: '7 days',
        billingUrl: 'https://clientific.app/dashboard/settings/billing',
      }),
    );
    expect(mockSendTrialEndingReminderEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        reminderLabel: '1 day',
      }),
    );
  });

  it('does not send duplicate notices when a reminder was already recorded', async () => {
    mockBusinessFindMany
      .mockResolvedValueOnce([baseBusiness])
      .mockResolvedValueOnce([]);
    mockTrialReminderCreate.mockRejectedValueOnce({ code: 'P2002' });

    const summary = await sendDueTrialEndingReminders({
      now: new Date('2026-06-01T12:00:00.000Z'),
    });

    expect(summary.sentCount).toBe(0);
    expect(summary.skippedCount).toBe(1);
    expect(mockSendTrialEndingReminderEmail).not.toHaveBeenCalled();
  });

  it('skips App Store-managed trials because Apple handles App Store billing notices', async () => {
    const result = await sendTrialReminderForBusiness({
      business: {
        ...baseBusiness,
        billingProvider: 'app_store',
      },
      noticeType: 'trial_ends_in_1_day',
      reminderLabel: '1 day',
      source: 'test',
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'not a Stripe-managed subscription',
    });
    expect(mockTrialReminderCreate).not.toHaveBeenCalled();
    expect(mockSendTrialEndingReminderEmail).not.toHaveBeenCalled();
  });

  it('rolls back the durable notice marker when the email provider fails', async () => {
    mockTrialReminderCreate.mockResolvedValueOnce({ id: 'notice-fail' });
    mockSendTrialEndingReminderEmail.mockRejectedValueOnce(new Error('resend down'));

    const result = await sendTrialReminderForBusiness({
      business: baseBusiness,
      noticeType: 'trial_ends_in_7_days',
      reminderLabel: '7 days',
      source: 'test',
    });

    expect(result.status).toBe('failed');
    expect(mockTrialReminderDelete).toHaveBeenCalledWith({ where: { id: 'notice-fail' } });
  });

  it('sends the Stripe trial_will_end reminder as a provider-backed fail-safe', async () => {
    mockBusinessFindUnique.mockResolvedValueOnce({
      ...baseBusiness,
      trialEndsAt: null,
    });

    const result = await sendStripeTrialWillEndReminder({
      id: 'sub_123',
      trial_end: 1770051600,
      items: { data: [{ price: { id: 'price_pro' } }] },
    } as any);

    expect(result.status).toBe('sent');
    expect(mockBusinessFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: 'sub_123' },
      }),
    );
    expect(mockTrialReminderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          noticeType: 'stripe_trial_will_end',
          source: 'stripe_webhook',
          trialEndsAt: new Date(1770051600 * 1000),
        }),
      }),
    );
    expect(mockSendTrialEndingReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderLabel: 'about 3 days',
      }),
    );
  });
});
