import { ClientificApiError } from '@/lib/clientific-api';
import {
  hasActiveAppStorePurchaseResult,
  isRecoverableAppStoreSyncError,
  isPendingAppStoreSyncError,
  resolvePendingAppStoreSyncSnapshot,
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

  it('treats transient and server sync errors as recoverable but preserves conflict errors', () => {
    expect(
      isRecoverableAppStoreSyncError(
        new ClientificApiError(
          'No App Store subscription was found for this business yet.',
          409,
          'APP_STORE_SUBSCRIPTION_NOT_FOUND',
        ),
      ),
    ).toBe(true);

    expect(
      isRecoverableAppStoreSyncError(
        new ClientificApiError('Unable to sync your App Store subscription right now.', 500),
      ),
    ).toBe(true);

    expect(
      isRecoverableAppStoreSyncError(
        new ClientificApiError(
          'This App Store subscription already belongs to a different Clientific business account.',
          409,
          'APP_STORE_SUBSCRIPTION_OWNERSHIP_CONFLICT',
        ),
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

  it('derives a pending local App Store snapshot from active CustomerInfo', () => {
    expect(
      resolvePendingAppStoreSyncSnapshot({
        customerInfo: {
          activeSubscriptions: ['app.clientific.mobile.pro.monthly'],
          entitlements: {
            active: {
              clientific_access: {
                identifier: 'clientific_access',
                productIdentifier: 'app.clientific.mobile.pro.monthly',
                periodType: 'TRIAL',
                expirationDate: '2026-05-18T00:00:00.000Z',
              } as PurchasesEntitlementInfo,
            },
            all: {},
            verification: 'NOT_REQUESTED' as CustomerInfo['entitlements']['verification'],
          },
          latestExpirationDate: '2026-05-18T00:00:00.000Z',
          subscriptionsByProductIdentifier: {
            'app.clientific.mobile.pro.monthly': {
              productIdentifier: 'app.clientific.mobile.pro.monthly',
              expiresDate: '2026-05-18T00:00:00.000Z',
              periodType: 'TRIAL',
              isActive: true,
            },
          },
        } as unknown as CustomerInfo,
      }),
    ).toEqual({
      plan: 'pro',
      subscriptionStatus: 'trialing',
      productId: 'app.clientific.mobile.pro.monthly',
      trialEndsAt: '2026-05-18T00:00:00.000Z',
      subscriptionCurrentPeriodEnd: '2026-05-18T00:00:00.000Z',
    });
  });
});
