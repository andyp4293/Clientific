import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { sendTrialEndingReminderEmail } from '@/lib/email';
import { getPricingPlanKey, getPublicPlanLabel } from '@/lib/plan-utils';
import { prisma } from '@/lib/prisma';
import { PRICING_PLANS } from '@/lib/stripe';

const DAY_MS = 24 * 60 * 60 * 1000;

export const TRIAL_REMINDER_WINDOWS = [
  {
    noticeType: 'trial_ends_in_7_days',
    daysBefore: 7,
    reminderLabel: '7 days',
  },
  {
    noticeType: 'trial_ends_in_1_day',
    daysBefore: 1,
    reminderLabel: '1 day',
  },
] as const;

export const STRIPE_TRIAL_WILL_END_NOTICE_TYPE = 'stripe_trial_will_end';

type TrialReminderNoticeType =
  | (typeof TRIAL_REMINDER_WINDOWS)[number]['noticeType']
  | typeof STRIPE_TRIAL_WILL_END_NOTICE_TYPE;

type TrialReminderBusiness = {
  id: string;
  email: string;
  name: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  billingProvider: string | null;
  trialEndsAt: Date | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  appStoreOriginalTransactionId: string | null;
  appStoreProductId: string | null;
};

type TrialReminderResult =
  | { status: 'sent'; noticeId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: unknown };

type TrialReminderSummary = {
  checkedCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
};

const trialReminderBusinessSelect = {
  id: true,
  email: true,
  name: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  billingProvider: true,
  trialEndsAt: true,
  stripeSubscriptionId: true,
  stripePriceId: true,
  appStoreOriginalTransactionId: true,
  appStoreProductId: true,
} as const;

function isUniqueConstraintError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
    (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002')
  );
}

function getTrialWindow(now: Date, daysBefore: number) {
  const startsAt = new Date(now.getTime() + daysBefore * DAY_MS);
  const endsBefore = new Date(startsAt.getTime() + DAY_MS);
  return { startsAt, endsBefore };
}

function getPlanEmailDetails(business: TrialReminderBusiness) {
  const planKey = getPricingPlanKey(business.subscriptionPlan);
  const plan = planKey ? PRICING_PLANS[planKey] : null;
  const planName = plan?.name ?? getPublicPlanLabel(business.subscriptionPlan);
  const priceLabel = plan ? `$${plan.price}/month` : 'your selected monthly subscription price';

  return { planName, priceLabel };
}

function shouldSendTrialReminder(business: TrialReminderBusiness) {
  if (!business.email.trim()) {
    return 'missing email';
  }

  if (!['stripe', 'app_store'].includes(business.billingProvider ?? '')) {
    return 'not an auto-renewing billing provider';
  }

  if (business.subscriptionStatus !== 'trialing') {
    return 'subscription is not trialing';
  }

  if (!business.trialEndsAt) {
    return 'missing trial end date';
  }

  if (business.billingProvider === 'stripe' && !business.stripeSubscriptionId) {
    return 'missing Stripe subscription';
  }

  if (
    business.billingProvider === 'app_store' &&
    !business.appStoreOriginalTransactionId &&
    !business.appStoreProductId
  ) {
    return 'missing App Store subscription';
  }

  return null;
}

export async function sendTrialReminderForBusiness({
  business,
  noticeType,
  reminderLabel,
  source,
}: {
  business: TrialReminderBusiness;
  noticeType: TrialReminderNoticeType;
  reminderLabel: string;
  source: string;
}): Promise<TrialReminderResult> {
  const skipReason = shouldSendTrialReminder(business);
  if (skipReason) {
    return { status: 'skipped', reason: skipReason };
  }

  let notice: { id: string } | null = null;
  const trialEndsAt = business.trialEndsAt!;

  try {
    notice = await prisma.trialReminderNotice.create({
      data: {
        businessId: business.id,
        noticeType,
        trialEndsAt,
        billingProvider: business.billingProvider!,
        email: business.email,
        source,
      },
      select: {
        id: true,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: 'skipped', reason: 'reminder already sent for this trial end date' };
    }

    throw error;
  }

  try {
    const { planName, priceLabel } = getPlanEmailDetails(business);

    await sendTrialEndingReminderEmail({
      to: business.email,
      businessName: business.name,
      planName,
      priceLabel,
      trialEndsAt,
      billingUrl: `${getConfiguredAppBaseUrl()}/dashboard/settings/billing`,
      reminderLabel,
    });

    return { status: 'sent', noticeId: notice.id };
  } catch (error) {
    try {
      await prisma.trialReminderNotice.delete({ where: { id: notice.id } });
    } catch (deleteError) {
      console.warn('Failed to roll back trial reminder notice after email error:', deleteError);
    }

    return { status: 'failed', error };
  }
}

export async function sendDueTrialEndingReminders({
  now = new Date(),
  source = 'cron',
}: {
  now?: Date;
  source?: string;
} = {}): Promise<TrialReminderSummary> {
  const summary: TrialReminderSummary = {
    checkedCount: 0,
    sentCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };

  for (const window of TRIAL_REMINDER_WINDOWS) {
    const { startsAt, endsBefore } = getTrialWindow(now, window.daysBefore);
    const businesses = await prisma.business.findMany({
      where: {
        billingProvider: { in: ['stripe', 'app_store'] },
        subscriptionStatus: 'trialing',
        OR: [
          {
            billingProvider: 'stripe',
            stripeSubscriptionId: { not: null },
          },
          {
            billingProvider: 'app_store',
            OR: [
              { appStoreOriginalTransactionId: { not: null } },
              { appStoreProductId: { not: null } },
            ],
          },
        ],
        trialEndsAt: {
          gte: startsAt,
          lt: endsBefore,
        },
      },
      select: trialReminderBusinessSelect,
      orderBy: {
        trialEndsAt: 'asc',
      },
      take: 500,
    });

    for (const business of businesses) {
      summary.checkedCount += 1;
      const result = await sendTrialReminderForBusiness({
        business,
        noticeType: window.noticeType,
        reminderLabel: window.reminderLabel,
        source,
      });

      if (result.status === 'sent') {
        summary.sentCount += 1;
      } else if (result.status === 'failed') {
        summary.failedCount += 1;
        console.error('Failed to send trial ending reminder:', business.id, result.error);
      } else {
        summary.skippedCount += 1;
      }
    }
  }

  return summary;
}

export async function sendStripeTrialWillEndReminder(subscription: Stripe.Subscription) {
  if (!subscription.trial_end) {
    return { status: 'skipped' as const, reason: 'missing Stripe trial end date' };
  }

  const business = await prisma.business.findUnique({
    where: {
      stripeSubscriptionId: subscription.id,
    },
    select: trialReminderBusinessSelect,
  });

  if (!business) {
    return { status: 'skipped' as const, reason: 'business not found' };
  }

  return sendTrialReminderForBusiness({
    business: {
      ...business,
      trialEndsAt: new Date(subscription.trial_end * 1000),
      stripePriceId: subscription.items.data[0]?.price.id ?? business.stripePriceId,
    },
    noticeType: STRIPE_TRIAL_WILL_END_NOTICE_TYPE,
    reminderLabel: 'about 3 days',
    source: 'stripe_webhook',
  });
}
