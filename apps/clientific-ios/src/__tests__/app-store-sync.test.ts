import { ClientificApiError } from '@/lib/clientific-api';
import {
  hasActiveAppStorePurchaseResult,
  isPendingAppStoreSyncError,
} from '@/lib/app-store-sync';
import type { CustomerInfo, PurchasesEntitlementInfo } from 'react-native-purchases';

const emptyEntitlements = {
  active: {},
  all: {},
  verification: 'NOT_REQUESTED' as CustomerInfo['entitlements']['verification'],
} as CustomerInfo['entitlements'];

const activeEntitlement = {
  identifier: 'clientific_access',
} as PurchasesEntitlementInfo;

describe('app-store-sync helpers', () => {
  it('detects the transient RevenueCat sync error code', () => {
    expect(
      isPendingAppStoreSyncError(
        new ClientificApiError(
          'No App Store subscription was found for this business yet.',
          409,
          'APP_STORE_SUBSCRIPTION_NOT_FOUND',
        ),
      ),
    ).toBe(true);

    expect(
      isPendingAppStoreSyncError(
        new ClientificApiError('Conflict', 409, 'APP_STORE_SUBSCRIPTION_CONFLICT'),
      ),
    ).toBe(false);
  });

  it('recognizes a purchase result that already contains an active App Store subscription', () => {
    expect(
      hasActiveAppStorePurchaseResult({
        customerInfo: {
          activeSubscriptions: ['app.clientific.mobile.starter.monthly'],
          entitlements: emptyEntitlements,
        } as unknown as CustomerInfo,
      }),
    ).toBe(true);

    expect(
      hasActiveAppStorePurchaseResult({
        activeSubscriptions: [],
        entitlements: {
          active: {
            clientific_access: activeEntitlement,
          },
          all: {
            clientific_access: activeEntitlement,
          },
          verification: 'NOT_REQUESTED' as CustomerInfo['entitlements']['verification'],
        },
      }),
    ).toBe(true);

    expect(
      hasActiveAppStorePurchaseResult({
        customerInfo: {
          activeSubscriptions: [],
          entitlements: emptyEntitlements,
        } as unknown as CustomerInfo,
      }),
    ).toBe(false);
  });
});
