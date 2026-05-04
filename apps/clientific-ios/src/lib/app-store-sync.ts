import type { ClientificApiError } from '@/lib/clientific-api';
import type {
  MakePurchaseResult,
  CustomerInfo,
  PurchasesEntitlementInfo,
} from 'react-native-purchases';

export type PendingAppStoreSyncSnapshot = {
  plan: 'starter' | 'pro' | 'premium';
  subscriptionStatus: 'active' | 'trialing';
  productId: string;
  trialEndsAt: string | null;
  subscriptionCurrentPeriodEnd: string | null;
};

const NON_RECOVERABLE_APP_STORE_SYNC_CODES = new Set([
  'APP_STORE_SUBSCRIPTION_OWNERSHIP_CONFLICT',
  'APP_STORE_SUBSCRIPTION_CONFLICT',
  'APP_STORE_APP_USER_ID_MISMATCH',
]);

export function isPendingAppStoreSyncError(error: unknown) {
  return (
    error instanceof Error &&
    error.name === 'ClientificApiError' &&
    (error as ClientificApiError).code === 'APP_STORE_SUBSCRIPTION_NOT_FOUND'
  );
}

export function isRecoverableAppStoreSyncError(error: unknown) {
  if (isPendingAppStoreSyncError(error)) {
    return true;
  }

  if (error instanceof Error && error.name === 'ClientificApiError') {
    const clientificError = error as ClientificApiError;
    if (clientificError.status >= 500) {
      return true;
    }

    return clientificError.code
      ? !NON_RECOVERABLE_APP_STORE_SYNC_CODES.has(clientificError.code)
      : false;
  }

  return error instanceof Error;
}

export function hasActiveAppStorePurchaseResult(
  result:
    | Pick<MakePurchaseResult, 'customerInfo'>
    | Pick<CustomerInfo, 'activeSubscriptions' | 'entitlements'>
    | null
    | undefined,
) {
  const customerInfo =
    result && 'customerInfo' in result ? result.customerInfo : result;

  return Boolean(
    customerInfo?.activeSubscriptions?.length ||
      Object.keys(customerInfo?.entitlements?.active ?? {}).length,
  );
}

function getRevenueCatProductRank(productId: string) {
  const normalized = productId.trim().toLowerCase();
  if (normalized.includes('starter')) return 0;
  if (normalized.includes('pro')) return 1;
  if (normalized.includes('premium')) return 2;
  return 99;
}

function getRevenueCatPlanFromProductId(productId: string) {
  const normalized = productId.trim().toLowerCase();
  if (normalized.includes('starter')) return 'starter' as const;
  if (normalized.includes('pro')) return 'pro' as const;
  if (normalized.includes('premium')) return 'premium' as const;
  return null;
}

function getMatchingEntitlementForProductId(
  customerInfo: Pick<CustomerInfo, 'entitlements'>,
  productId: string,
): PurchasesEntitlementInfo | null {
  return (
    Object.values(customerInfo.entitlements.active).find(
      (entitlement) => entitlement.productIdentifier === productId,
    ) ?? null
  );
}

export function resolvePendingAppStoreSyncSnapshot(
  result:
    | Pick<MakePurchaseResult, 'customerInfo'>
    | Pick<CustomerInfo, 'activeSubscriptions' | 'entitlements' | 'subscriptionsByProductIdentifier' | 'latestExpirationDate'>
    | null
    | undefined,
): PendingAppStoreSyncSnapshot | null {
  const customerInfo =
    result && 'customerInfo' in result ? result.customerInfo : result;

  if (!customerInfo) {
    return null;
  }

  const activeProductIds = [
    ...customerInfo.activeSubscriptions,
    ...Object.values(customerInfo.entitlements.active).map(
      (entitlement) => entitlement.productIdentifier,
    ),
    ...Object.entries(customerInfo.subscriptionsByProductIdentifier ?? {})
      .filter(([, subscription]) => subscription?.isActive)
      .map(([productId]) => productId),
  ];

  const selectedProductId = [...new Set(activeProductIds)]
    .filter((productId) => Boolean(getRevenueCatPlanFromProductId(productId)))
    .sort((left, right) => getRevenueCatProductRank(left) - getRevenueCatProductRank(right))[0];

  if (!selectedProductId) {
    return null;
  }

  const plan = getRevenueCatPlanFromProductId(selectedProductId);
  if (!plan) {
    return null;
  }

  const subscriptionInfo =
    customerInfo.subscriptionsByProductIdentifier?.[selectedProductId] ?? null;
  const entitlement = getMatchingEntitlementForProductId(customerInfo, selectedProductId);
  const expirationDate =
    subscriptionInfo?.expiresDate ??
    entitlement?.expirationDate ??
    customerInfo.latestExpirationDate ??
    null;
  const periodType = subscriptionInfo?.periodType ?? entitlement?.periodType ?? 'NORMAL';
  const subscriptionStatus = periodType === 'TRIAL' ? 'trialing' : 'active';

  return {
    plan,
    subscriptionStatus,
    productId: selectedProductId,
    trialEndsAt: subscriptionStatus === 'trialing' ? expirationDate : null,
    subscriptionCurrentPeriodEnd: expirationDate,
  };
}
