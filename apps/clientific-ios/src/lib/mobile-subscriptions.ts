import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesError,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

let isRevenueCatConfigured = false;
let configuredAppUserId: string | null = null;

const APP_STORE_BILLING_UNAVAILABLE_MESSAGE =
  'App Store billing is temporarily unavailable right now. Please try again shortly.';
const APP_STORE_PLANS_UNAVAILABLE_MESSAGE =
  'App Store plans are not available yet for this account. Pull to refresh or try again shortly.';
const REVENUECAT_LOGIN_TIMEOUT_MS = 12_000;
const REVENUECAT_OFFERINGS_TIMEOUT_MS = 12_000;
const REVENUECAT_PURCHASE_TIMEOUT_MS = 45_000;
const REVENUECAT_RESTORE_TIMEOUT_MS = 20_000;
const REVENUECAT_CUSTOMER_CENTER_TIMEOUT_MS = 15_000;
const FALLBACK_OFFERING_IDENTIFIER = '__clientific_fallback_offering__';

function isRevenueCatConfigurationErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  return (
    normalized.includes("there's a problem with your configuration") ||
    normalized.includes('there is an issue with your configuration') ||
    normalized.includes('none of the products registered in the revenuecat dashboard') ||
    normalized.includes('could be fetched from app store connect') ||
    normalized.includes('could be fetched from the storekit configuration') ||
    normalized.includes('why-are-offerings-empty') ||
    normalized.includes('rev.cat/sdk-troubleshooting')
  );
}

function isAlreadySafeAppStoreBillingMessage(message: string) {
  const normalized = message.trim();

  return (
    normalized === APP_STORE_BILLING_UNAVAILABLE_MESSAGE ||
    normalized === APP_STORE_PLANS_UNAVAILABLE_MESSAGE ||
    normalized.startsWith('App Store ') ||
    normalized.startsWith('The App Store ')
  );
}

function getConfiguredRevenueCatProductIdSets() {
  const explicitProductIds = [
    process.env.EXPO_PUBLIC_REVENUECAT_STARTER_PRODUCT_ID?.trim(),
    process.env.EXPO_PUBLIC_REVENUECAT_PRO_PRODUCT_ID?.trim(),
    process.env.EXPO_PUBLIC_REVENUECAT_PREMIUM_PRODUCT_ID?.trim(),
  ].filter((value): value is string => Boolean(value));

  const candidateSets = [
    explicitProductIds.length === 3 ? explicitProductIds : null,
    [
      'clientific_starter_monthly',
      'clientific_pro_monthly',
      'clientific_premium_monthly',
    ],
    [
      'com.clientific.starter.monthly',
      'com.clientific.pro.monthly',
      'com.clientific.premium.monthly',
    ],
    [
      'app.clientific.mobile.starter.monthly',
      'app.clientific.mobile.pro.monthly',
      'app.clientific.mobile.premium.monthly',
    ],
  ].filter((value): value is string[] => Array.isArray(value));

  return candidateSets.map((set) => [...new Set(set)]);
}

function getProductRank(productIdentifier: string | null | undefined) {
  const normalized = productIdentifier?.trim().toLowerCase() ?? '';
  if (normalized.includes('starter')) return 0;
  if (normalized.includes('pro')) return 1;
  if (normalized.includes('premium')) return 2;
  return 99;
}

function getFallbackPackageType(product: PurchasesStoreProduct) {
  switch (product.subscriptionPeriod) {
    case 'P1W':
      return 'WEEKLY';
    case 'P1M':
      return 'MONTHLY';
    case 'P2M':
      return 'TWO_MONTH';
    case 'P3M':
      return 'THREE_MONTH';
    case 'P6M':
      return 'SIX_MONTH';
    case 'P1Y':
      return 'ANNUAL';
    default:
      return 'CUSTOM';
  }
}

function buildFallbackPackage(product: PurchasesStoreProduct): PurchasesPackage {
  const offeringContext = {
    offeringIdentifier: FALLBACK_OFFERING_IDENTIFIER,
    placementIdentifier: null,
    targetingContext: null,
  };

  return {
    identifier: product.identifier,
    packageType: getFallbackPackageType(product) as never,
    offeringIdentifier: FALLBACK_OFFERING_IDENTIFIER,
    presentedOfferingContext: offeringContext,
    webCheckoutUrl: null,
    product,
  } as PurchasesPackage;
}

function buildFallbackOffering(products: PurchasesStoreProduct[]) {
  if (!products.length) {
    return null;
  }

  const packages = [...products]
    .sort((left, right) => getProductRank(left.identifier) - getProductRank(right.identifier))
    .map((product) => buildFallbackPackage(product));

  const byType = (packageType: string) =>
    packages.find((entry) => entry.packageType === packageType) ?? null;

  return {
    identifier: FALLBACK_OFFERING_IDENTIFIER,
    serverDescription: 'Clientific App Store plans',
    metadata: {},
    availablePackages: packages,
    lifetime: byType('LIFETIME'),
    annual: byType('ANNUAL'),
    sixMonth: byType('SIX_MONTH'),
    threeMonth: byType('THREE_MONTH'),
    twoMonth: byType('TWO_MONTH'),
    monthly: byType('MONTHLY'),
    weekly: byType('WEEKLY'),
  } as PurchasesOffering;
}

function isFallbackPackage(aPackage: PurchasesPackage) {
  return aPackage.offeringIdentifier === FALLBACK_OFFERING_IDENTIFIER;
}

async function loadFallbackOfferingFromProducts() {
  const productIdSets = getConfiguredRevenueCatProductIdSets();
  let lastError: unknown = null;

  for (const productIds of productIdSets) {
    try {
      const products = await withRevenueCatTimeout(
        Purchases.getProducts(productIds, Purchases.PRODUCT_CATEGORY.SUBSCRIPTION),
        REVENUECAT_OFFERINGS_TIMEOUT_MS,
        'App Store plans are taking longer than expected to load. Pull to refresh and try again.',
      );
      const fallbackOffering = buildFallbackOffering(products);
      if (fallbackOffering?.availablePackages.length) {
        return fallbackOffering;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

function getRevenueCatApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(APP_STORE_BILLING_UNAVAILABLE_MESSAGE);
  }

  return apiKey;
}

export function getAppStoreBillingUnavailableMessage() {
  return APP_STORE_BILLING_UNAVAILABLE_MESSAGE;
}

export function getAppStorePlansUnavailableMessage() {
  return APP_STORE_PLANS_UNAVAILABLE_MESSAGE;
}

export function getSafeAppStoreBillingErrorMessage(
  error: unknown,
  fallback = APP_STORE_BILLING_UNAVAILABLE_MESSAGE,
) {
  if (error instanceof Error && error.message) {
    if (isAlreadySafeAppStoreBillingMessage(error.message)) {
      return error.message;
    }

    if (isRevenueCatConfigurationErrorMessage(error.message)) {
      return APP_STORE_PLANS_UNAVAILABLE_MESSAGE;
    }
  }

  return fallback;
}

export function buildMobileRevenueCatAppUserId(businessId: string) {
  return `business:${businessId}`;
}

async function withRevenueCatTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function configureRevenueCatForBusiness(businessId: string) {
  const appUserId = buildMobileRevenueCatAppUserId(businessId);

  if (!isRevenueCatConfigured) {
    await Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
    Purchases.configure({
      apiKey: getRevenueCatApiKey(),
      appUserID: appUserId,
    });
    isRevenueCatConfigured = true;
    configuredAppUserId = appUserId;
    return appUserId;
  }

  if (configuredAppUserId !== appUserId) {
    await withRevenueCatTimeout(
      Purchases.logIn(appUserId),
      REVENUECAT_LOGIN_TIMEOUT_MS,
      'App Store account sync is taking longer than expected. Pull to refresh and try again.',
    );
    configuredAppUserId = appUserId;
  }

  return appUserId;
}

export async function clearRevenueCatUser() {
  if (!isRevenueCatConfigured || !configuredAppUserId) {
    return;
  }

  try {
    await Purchases.logOut();
  } catch (error) {
    console.warn('RevenueCat logout failed:', error);
  } finally {
    configuredAppUserId = null;
  }
}

export async function getCurrentRevenueCatOffering() {
  try {
    const offerings = await withRevenueCatTimeout(
      Purchases.getOfferings(),
      REVENUECAT_OFFERINGS_TIMEOUT_MS,
      'App Store plans are taking longer than expected to load. Pull to refresh and try again.',
    );
    const primaryOffering =
      offerings.current ??
      Object.values(offerings.all ?? {}).find(
        (offering): offering is PurchasesOffering => Boolean(offering),
      ) ??
      null;

    if (primaryOffering?.availablePackages?.length) {
      return primaryOffering;
    }
  } catch (error) {
    if (!isRevenueCatConfigurationErrorMessage(error instanceof Error ? error.message : '')) {
      throw new Error(
        getSafeAppStoreBillingErrorMessage(
          error,
          'Unable to load App Store plan options right now.',
        ),
      );
    }

    try {
      return await loadFallbackOfferingFromProducts();
    } catch (fallbackError) {
      if (
        isRevenueCatConfigurationErrorMessage(
          fallbackError instanceof Error ? fallbackError.message : '',
        ) ||
        isRevenueCatConfigurationErrorMessage(
          error instanceof Error ? error.message : '',
        )
      ) {
        return null;
      }

      throw new Error(
        getSafeAppStoreBillingErrorMessage(
          fallbackError,
          'Unable to load App Store plan options right now.',
        ),
      );
    }
  }

  try {
    return await loadFallbackOfferingFromProducts();
  } catch (error) {
    if (isRevenueCatConfigurationErrorMessage(error instanceof Error ? error.message : '')) {
      return null;
    }

    throw new Error(
      getSafeAppStoreBillingErrorMessage(
        error,
        'Unable to load App Store plan options right now.',
      ),
    );
  }
}

export async function purchaseRevenueCatPackage(aPackage: PurchasesPackage) {
  return withRevenueCatTimeout(
    isFallbackPackage(aPackage)
      ? Purchases.purchaseStoreProduct(aPackage.product)
      : Purchases.purchasePackage(aPackage),
    REVENUECAT_PURCHASE_TIMEOUT_MS,
    'The App Store purchase is taking longer than expected. If you were charged, pull to refresh or use Restore Purchases in a few seconds.',
  );
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  return withRevenueCatTimeout(
    Purchases.restorePurchases(),
    REVENUECAT_RESTORE_TIMEOUT_MS,
    'App Store restore is taking longer than expected. Pull to refresh and try again.',
  );
}

export async function presentRevenueCatCustomerCenter() {
  return withRevenueCatTimeout(
    RevenueCatUI.presentCustomerCenter(),
    REVENUECAT_CUSTOMER_CENTER_TIMEOUT_MS,
    'App Store subscription management is taking longer than expected to open. Please try again.',
  );
}

export function isRevenueCatPurchaseCancelled(error: unknown) {
  const purchaseError = error as PurchasesError | null;

  return (
    purchaseError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    purchaseError?.userCancelled === true
  );
}
