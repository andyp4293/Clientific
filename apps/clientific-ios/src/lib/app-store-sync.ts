import type { ClientificApiError } from '@/lib/clientific-api';
import type {
  MakePurchaseResult,
  CustomerInfo,
} from 'react-native-purchases';

export function isPendingAppStoreSyncError(error: unknown) {
  return (
    error instanceof Error &&
    error.name === 'ClientificApiError' &&
    (error as ClientificApiError).code === 'APP_STORE_SUBSCRIPTION_NOT_FOUND'
  );
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
