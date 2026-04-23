import { ClientificApiError } from '@/lib/clientific-api';
import {
  hasActiveAppStorePurchaseResult,
  isPendingAppStoreSyncError,
} from '@/lib/app-store-sync';

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
          entitlements: { active: {} },
        },
      }),
    ).toBe(true);

    expect(
      hasActiveAppStorePurchaseResult({
        activeSubscriptions: [],
        entitlements: {
          active: {
            clientific_access: {
              identifier: 'clientific_access',
            },
          },
        },
      }),
    ).toBe(true);

    expect(
      hasActiveAppStorePurchaseResult({
        customerInfo: {
          activeSubscriptions: [],
          entitlements: { active: {} },
        },
      }),
    ).toBe(false);
  });
});
