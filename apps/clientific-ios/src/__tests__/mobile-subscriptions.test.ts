import Purchases from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import {
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
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
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
  purchasePackage: jest.Mock;
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
      current: { identifier: 'default' },
      all: {},
    });

    await expect(getCurrentRevenueCatOffering()).resolves.toEqual({
      identifier: 'default',
    });
  });

  it('times out if App Store plans never load', async () => {
    mockPurchases.getOfferings.mockReturnValue(new Promise(() => undefined));

    const promise = getCurrentRevenueCatOffering();
    jest.advanceTimersByTime(12_000);

    await expect(promise).rejects.toThrow(
      'App Store plans are taking longer than expected to load. Pull to refresh and try again.',
    );
  });

  it('times out if a purchase never resolves', async () => {
    mockPurchases.purchasePackage.mockReturnValue(new Promise(() => undefined));

    const promise = purchaseRevenueCatPackage({ identifier: 'starter_monthly' } as never);
    jest.advanceTimersByTime(45_000);

    await expect(promise).rejects.toThrow(
      'The App Store purchase is taking longer than expected. If you were charged, pull to refresh or use Restore Purchases in a few seconds.',
    );
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
