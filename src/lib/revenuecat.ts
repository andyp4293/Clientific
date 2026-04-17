import { prisma } from '@/lib/prisma';
import { normalizeBillingProvider } from '@/lib/billing-provider';
import {
  isSubscriptionAccessActive,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '@/lib/subscription';

type RevenueCatProductPlan = Exclude<SubscriptionPlan, 'trial'>;

type RevenueCatSubscriberSubscription = {
  billing_issues_detected_at?: string | null;
  expires_date?: string | null;
  is_sandbox?: boolean | null;
  original_purchase_date?: string | null;
  ownership_type?: string | null;
  period_type?: string | null;
  store?: string | null;
  store_transaction_id?: string | null;
  original_transaction_id?: string | null;
  unsubscribe_detected_at?: string | null;
};

type RevenueCatSubscriber = {
  original_app_user_id?: string | null;
  subscriptions?: Record<string, RevenueCatSubscriberSubscription>;
};

export type RevenueCatWebhookEvent = {
  id?: string;
  type?: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[];
  product_id?: string | null;
  entitlement_ids?: string[] | null;
  environment?: string | null;
  expiration_at_ms?: number | null;
  expiration_at?: string | null;
  purchased_at_ms?: number | null;
  purchased_at?: string | null;
  original_transaction_id?: string | null;
  store?: string | null;
  period_type?: string | null;
  cancel_reason?: string | null;
};

export type RevenueCatSubscriptionSnapshot = {
  billingProvider: 'app_store';
  plan: RevenueCatProductPlan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  subscriptionCurrentPeriodEnd: Date | null;
  productId: string | null;
  originalTransactionId: string | null;
  environment: string | null;
  lastVerifiedAt: Date;
};

export type ApplyRevenueCatSubscriptionResult =
  | {
      applied: true;
      conflict: false;
      ownershipConflict: false;
      businessId: string;
      snapshot: RevenueCatSubscriptionSnapshot;
    }
  | {
      applied: false;
      conflict: true;
      ownershipConflict: false;
      businessId: string;
      snapshot: RevenueCatSubscriptionSnapshot;
    }
  | {
      applied: false;
      conflict: false;
      ownershipConflict: true;
      businessId: string;
      ownerBusinessId: string;
      snapshot: RevenueCatSubscriptionSnapshot;
    };

function getRevenueCatApiBaseUrl() {
  return (process.env.REVENUECAT_API_BASE_URL || 'https://api.revenuecat.com/v1').replace(
    /\/$/,
    '',
  );
}

function getRevenueCatSecretKey() {
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY?.trim();

  if (!secretKey) {
    throw new Error('Missing REVENUECAT_SECRET_API_KEY');
  }

  return secretKey;
}

export function buildRevenueCatAppUserId(businessId: string) {
  return `business:${businessId}`;
}

export function parseRevenueCatAppUserId(appUserId: string | null | undefined) {
  if (!appUserId) {
    return null;
  }

  const normalized = appUserId.trim();
  if (!normalized.startsWith('business:')) {
    return null;
  }

  const businessId = normalized.slice('business:'.length).trim();
  return businessId.length > 0 ? businessId : null;
}

function parseRevenueCatDate(
  value: string | number | null | undefined,
): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return new Date(value);
  }

  return null;
}

export function getRevenueCatProductPlan(
  productId: string | null | undefined,
): RevenueCatProductPlan | null {
  const normalized = productId?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }

  const configuredEntries = [
    [process.env.REVENUECAT_STARTER_PRODUCT_ID, 'starter'],
    [process.env.REVENUECAT_PRO_PRODUCT_ID, 'pro'],
    [process.env.REVENUECAT_PREMIUM_PRODUCT_ID, 'premium'],
  ] as const;

  for (const [configuredProductId, plan] of configuredEntries) {
    if (configuredProductId?.trim().toLowerCase() === normalized) {
      return plan;
    }
  }

  if (normalized.includes('premium')) {
    return 'premium';
  }

  if (normalized.includes('starter')) {
    return 'starter';
  }

  if (normalized.includes('pro')) {
    return 'pro';
  }

  return null;
}

function coerceRevenueCatEnvironment(args: {
  explicitEnvironment?: string | null;
  isSandbox?: boolean | null;
}) {
  if (args.explicitEnvironment?.trim()) {
    return args.explicitEnvironment.trim();
  }

  if (args.isSandbox === true) {
    return 'Sandbox';
  }

  if (args.isSandbox === false) {
    return 'Production';
  }

  return null;
}

function deriveSubscriptionStatus(args: {
  expiresAt: Date | null;
  periodType: string | null | undefined;
  billingIssueDetectedAt: string | null | undefined;
  explicitType?: string | null | undefined;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const normalizedType = args.explicitType?.trim().toUpperCase() ?? '';
  const normalizedPeriodType = args.periodType?.trim().toLowerCase() ?? '';
  const expiresAt = args.expiresAt;

  if (
    normalizedType === 'EXPIRATION' ||
    normalizedType === 'SUBSCRIPTION_PAUSED' ||
    (expiresAt && now >= expiresAt)
  ) {
    return 'canceled' as const;
  }

  if (normalizedType === 'BILLING_ISSUE' && expiresAt && now < expiresAt) {
    return 'grace_period' as const;
  }

  if (args.billingIssueDetectedAt && expiresAt && now < expiresAt) {
    return 'grace_period' as const;
  }

  if (normalizedPeriodType === 'trial' && expiresAt && now < expiresAt) {
    return 'trialing' as const;
  }

  if (expiresAt && now < expiresAt) {
    return 'active' as const;
  }

  return 'inactive' as const;
}

export async function fetchRevenueCatSubscriber(appUserId: string) {
  const response = await fetch(
    `${getRevenueCatApiBaseUrl()}/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${getRevenueCatSecretKey()}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`RevenueCat subscriber lookup failed (${response.status})`);
  }

  const payload = (await response.json()) as { subscriber?: RevenueCatSubscriber | null };
  if (!payload.subscriber) {
    throw new Error('RevenueCat subscriber payload was missing subscriber data');
  }

  return payload.subscriber;
}

export function resolveRevenueCatSubscriberSnapshot(
  subscriber: RevenueCatSubscriber,
  now: Date = new Date(),
): RevenueCatSubscriptionSnapshot | null {
  const knownSubscriptions = Object.entries(subscriber.subscriptions ?? {})
    .map(([productId, details]) => ({
      productId,
      details,
      plan: getRevenueCatProductPlan(productId),
      expiresAt: parseRevenueCatDate(details.expires_date),
    }))
    .filter(
      (
        entry,
      ): entry is {
        productId: string;
        details: RevenueCatSubscriberSubscription;
        plan: RevenueCatProductPlan;
        expiresAt: Date | null;
      } => entry.plan !== null,
    )
    .sort((left, right) => {
      const leftTime = left.expiresAt?.getTime() ?? 0;
      const rightTime = right.expiresAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });

  if (!knownSubscriptions.length) {
    return null;
  }

  const currentSubscription =
    knownSubscriptions.find((subscription) => {
      return subscription.expiresAt ? now < subscription.expiresAt : false;
    }) ?? knownSubscriptions[0];

  const subscriptionStatus = deriveSubscriptionStatus({
    expiresAt: currentSubscription.expiresAt,
    periodType: currentSubscription.details.period_type,
    billingIssueDetectedAt: currentSubscription.details.billing_issues_detected_at,
    now,
  });

  return {
    billingProvider: 'app_store',
    plan: currentSubscription.plan,
    subscriptionStatus,
    trialEndsAt:
      subscriptionStatus === 'trialing' ? currentSubscription.expiresAt : null,
    subscriptionCurrentPeriodEnd: currentSubscription.expiresAt,
    productId: currentSubscription.productId,
    originalTransactionId:
      currentSubscription.details.original_transaction_id ??
      currentSubscription.details.store_transaction_id ??
      null,
    environment: coerceRevenueCatEnvironment({
      isSandbox: currentSubscription.details.is_sandbox,
    }),
    lastVerifiedAt: now,
  };
}

export function resolveRevenueCatEventSnapshot(
  event: RevenueCatWebhookEvent,
  now: Date = new Date(),
): RevenueCatSubscriptionSnapshot | null {
  const plan = getRevenueCatProductPlan(event.product_id);
  if (!plan) {
    return null;
  }

  const expiresAt =
    parseRevenueCatDate(event.expiration_at_ms) ?? parseRevenueCatDate(event.expiration_at);
  const subscriptionStatus = deriveSubscriptionStatus({
    expiresAt,
    periodType: event.period_type,
    billingIssueDetectedAt: event.type?.toUpperCase() === 'BILLING_ISSUE' ? now.toISOString() : null,
    explicitType: event.type,
    now,
  });

  return {
    billingProvider: 'app_store',
    plan,
    subscriptionStatus,
    trialEndsAt: subscriptionStatus === 'trialing' ? expiresAt : null,
    subscriptionCurrentPeriodEnd: expiresAt,
    productId: event.product_id ?? null,
    originalTransactionId: event.original_transaction_id ?? null,
    environment: coerceRevenueCatEnvironment({
      explicitEnvironment: event.environment,
    }),
    lastVerifiedAt: now,
  };
}

export async function applyRevenueCatSubscriptionSnapshot(args: {
  businessId: string;
  snapshot: RevenueCatSubscriptionSnapshot;
}) {
  const { businessId, snapshot } = args;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      billingProvider: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionCurrentPeriodEnd: true,
      appStoreOriginalTransactionId: true,
    },
  });

  if (!business) {
    throw new Error(`Business not found for RevenueCat sync: ${businessId}`);
  }

  if (snapshot.originalTransactionId) {
    const owner = await prisma.business.findUnique({
      where: { appStoreOriginalTransactionId: snapshot.originalTransactionId },
      select: { id: true },
    });

    if (owner && owner.id !== businessId) {
      return {
        applied: false,
        conflict: false,
        ownershipConflict: true,
        businessId,
        ownerBusinessId: owner.id,
        snapshot,
      } satisfies ApplyRevenueCatSubscriptionResult;
    }
  }

  const isActiveStripeBusiness =
    normalizeBillingProvider(business.billingProvider) === 'stripe' &&
    isSubscriptionAccessActive(
      business.subscriptionStatus,
      business.trialEndsAt,
      business.subscriptionCurrentPeriodEnd,
    );

  const grantsActiveAccess = isSubscriptionAccessActive(
    snapshot.subscriptionStatus,
    snapshot.trialEndsAt,
    snapshot.subscriptionCurrentPeriodEnd,
  );

  if (isActiveStripeBusiness && grantsActiveAccess) {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        subscriptionConflictFlaggedAt: new Date(),
        subscriptionConflictSummary:
          'RevenueCat reported an App Store subscription for a business that already has active website billing. Manual review is recommended before changing billing ownership.',
      },
    });

    return {
      applied: false,
      conflict: true,
      ownershipConflict: false,
      businessId,
      snapshot,
    } satisfies ApplyRevenueCatSubscriptionResult;
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      subscriptionPlan: snapshot.plan,
      subscriptionStatus: snapshot.subscriptionStatus,
      billingProvider: 'app_store',
      trialEndsAt: snapshot.trialEndsAt,
      subscriptionCurrentPeriodEnd: snapshot.subscriptionCurrentPeriodEnd,
      appStoreOriginalTransactionId: snapshot.originalTransactionId,
      appStoreProductId: snapshot.productId,
      appStoreEnvironment: snapshot.environment,
      appStoreLastVerifiedAt: snapshot.lastVerifiedAt,
      subscriptionConflictFlaggedAt: null,
      subscriptionConflictSummary: null,
    },
  });

  return {
    applied: true,
    conflict: false,
    ownershipConflict: false,
    businessId,
    snapshot,
  } satisfies ApplyRevenueCatSubscriptionResult;
}
