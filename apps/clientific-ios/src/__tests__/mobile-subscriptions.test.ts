import Purchases from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import {
  configureRevenueCatForBusiness,
  getAppStoreBillingUnavailableMessage,
  getAppStorePlansUnavailableMessage,
  getCurrentRevenueCatOffering,
  presentRevenueCatCustomerCenter,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from '@/lib/mobile-subscriptions';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    LOG_LEVEL: { WARN: 'WARN' },
    PURCHASES_ERROR_CODE: {
      PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
    },
    setLogLevel: jest.fn(async () => undefined),
    configure: jest.fn(),
    logIn: jest.fn(async () => ({ customerInfo: {}, created: false })),
    logOut: jest.fn(async () => undefined),
    getOfferings: jest.fn(),
    getProducts: jest.fn(),
    purchasePackage: jest.fn(),
    purchaseStoreProduct: jest.fn(),
    restorePurchases: jest.fn(),
    PRODUCT_CATEGORY: {
      SUBSCRIPTION: 'SUBSCRIPTION',
    },
  },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
  },
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: {
    presentCustomerCenter: jest.fn(),
  },
}));

const mockPurchases = Purchases as unknown as {
  getOfferings: jest.Mock;
  getProducts: jest.Mock;
  purchasePackage: jest.Mock;
  purchaseStoreProduct: jest.Mock;
  restorePurchases: jest.Mock;
};

const mockRevenueCatUI = RevenueCatUI as unknown as {
  presentCustomerCenter: jest.Mock;
};

describe('mobile-subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the current RevenueCat offering when it loads in time', async () => {
    mockPurchases.getOfferings.mockResolvedValue({
      current: { identifier: 'default', availablePackages: [{ identifier: 'starter_monthly' }] },
      all: {},
    });

    await expect(getCurrentRevenueCatOffering()).resolves.toEqual(
      expect.objectContaining({
        identifier: 'default',
      }),
    );
  });

  it('falls back to direct App Store product lookup when no offering packages are available', async () => {
    mockPurchases.getOfferings.mockResolvedValue({
      current: null,
      all: {},
    });
    mockPurchases.getProducts.mockResolvedValue([
      {
        identifier: 'clientific_premium_monthly',
        description: 'Premium plan',
        title: 'Premium',
        priceString: '$99.00',
        subscriptionPeriod: 'P1M',
      },
      {
        identifier: 'clientific_starter_monthly',
        description: 'Starter plan',
        title: 'Starter',
        priceString: '$39.00',
        subscriptionPeriod: 'P1M',
      },
    ]);

    const offering = await getCurrentRevenueCatOffering();

    expect(mockPurchases.getProducts).toHaveBeenCalledWith(
      [
        'clientific_starter_monthly',
        'clientific_pro_monthly',
        'clientific_premium_monthly',
      ],
      'SUBSCRIPTION',
    );
    expect(offering?.availablePackages.map((entry: { identifier: string }) => entry.identifier)).toEqual([
      'clientific_starter_monthly',
      'clientific_premium_monthly',
    ]);
  });

  it('falls back to direct App Store product lookup when RevenueCat offerings throw a configuration error', async () => {
    mockPurchases.getOfferings.mockRejectedValue(
      new Error(
        "There's a problem with your configuration. None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect.",
      ),
    );
    mockPurchases.getProducts.mockResolvedValue([
      {
        identifier: 'app.clientific.mobile.starter.monthly',
        description: 'Starter plan',
        title: 'Starter',
        priceString: '$39.00',
        subscriptionPeriod: 'P1M',
      },
    ]);

    const offering = await getCurrentRevenueCatOffering();

    expect(mockPurchases.getProducts).toHaveBeenCalledWith(
      [
        'clientific_starter_monthly',
        'clientific_pro_monthly',
        'clientific_premium_monthly',
      ],
      'SUBSCRIPTION',
    );
    expect(offering?.availablePackages.map((entry: { identifier: string }) => entry.identifier)).toEqual([
      'app.clientific.mobile.starter.monthly',
    ]);
  });

  it('returns no offering instead of surfacing a raw RevenueCat configuration error', async () => {
    const configurationError = new Error(
      "There's a problem with your configuration. None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect.",
    );
    mockPurchases.getOfferings.mockRejectedValue(configurationError);
    mockPurchases.getProducts.mockRejectedValue(configurationError);

    await expect(getCurrentRevenueCatOffering()).resolves.toBeNull();
  });

  it('surfaces a user-safe App Store message when RevenueCat credentials are missing', async () => {
    const originalApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

    try {
      await expect(configureRevenueCatForBusiness('biz-1')).rejects.toThrow(
        getAppStoreBillingUnavailableMessage(),
      );
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
      } else {
        process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = originalApiKey;
      }
    }
  });

  it('surfaces a user-safe App Store plans unavailable message when RevenueCat returns a configuration issue', async () => {
    mockPurchases.getOfferings.mockResolvedValue({
      current: null,
      all: {},
    });
    mockPurchases.getProducts.mockRejectedValue(
      new Error(
        "There's a problem with your configuration. None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect.",
      ),
    );

    await expect(getCurrentRevenueCatOffering()).resolves.toBeNull();
    expect(getAppStorePlansUnavailableMessage()).toMatch(/App Store plans are not available yet/i);
  });

  it('times out if App Store plans never load', async () => {
    mockPurchases.getOfferings.mockReturnValue(new Promise(() => undefined));

    const promise = getCurrentRevenueCatOffering();
    const rejection = expect(promise).rejects.toThrow(
      'App Store plans are taking longer than expected to load. Pull to refresh and try again.',
    );
    await jest.advanceTimersByTimeAsync(12_000);

    await rejection;
  });

  it('times out if a purchase never resolves', async () => {
    mockPurchases.purchasePackage.mockReturnValue(new Promise(() => undefined));

    const promise = purchaseRevenueCatPackage({ identifier: 'starter_monthly' } as never);
    jest.advanceTimersByTime(45_000);

    await expect(promise).rejects.toThrow(
      'The App Store purchase is taking longer than expected. If you were charged, pull to refresh or use Restore Purchases in a few seconds.',
    );
  });

  it('uses direct product purchase for fallback App Store products', async () => {
    mockPurchases.purchaseStoreProduct.mockResolvedValue({
      customerInfo: { activeSubscriptions: ['clientific_starter_monthly'], entitlements: { active: {} } },
      productIdentifier: 'clientific_starter_monthly',
    });

    await purchaseRevenueCatPackage({
      identifier: 'clientific_starter_monthly',
      offeringIdentifier: '__clientific_fallback_offering__',
      product: { identifier: 'clientific_starter_monthly' },
    } as never);

    expect(mockPurchases.purchaseStoreProduct).toHaveBeenCalledWith({
      identifier: 'clientific_starter_monthly',
    });
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  it('times out if restore never resolves', async () => {
    mockPurchases.restorePurchases.mockReturnValue(new Promise(() => undefined));

    const promise = restoreRevenueCatPurchases();
    jest.advanceTimersByTime(20_000);

    await expect(promise).rejects.toThrow(
      'App Store restore is taking longer than expected. Pull to refresh and try again.',
    );
  });

  it('times out if customer center never opens', async () => {
    mockRevenueCatUI.presentCustomerCenter.mockReturnValue(new Promise(() => undefined));

    const promise = presentRevenueCatCustomerCenter();
    jest.advanceTimersByTime(15_000);

    await expect(promise).rejects.toThrow(
      'App Store subscription management is taking longer than expected to open. Please try again.',
    );
  });
});
