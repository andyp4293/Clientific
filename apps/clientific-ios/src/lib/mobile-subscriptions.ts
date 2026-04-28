import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesError,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

let isRevenueCatConfigured = false;
let configuredAppUserId: string | null = null;

const APP_STORE_BILLING_UNAVAILABLE_MESSAGE =
  'App Store billing is temporarily unavailable right now. Please try again shortly.';
const REVENUECAT_LOGIN_TIMEOUT_MS = 12_000;
const REVENUECAT_OFFERINGS_TIMEOUT_MS = 12_000;
const REVENUECAT_PURCHASE_TIMEOUT_MS = 45_000;
const REVENUECAT_RESTORE_TIMEOUT_MS = 20_000;
const REVENUECAT_CUSTOMER_CENTER_TIMEOUT_MS = 15_000;

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
  const offerings = await withRevenueCatTimeout(
    Purchases.getOfferings(),
    REVENUECAT_OFFERINGS_TIMEOUT_MS,
    'App Store plans are taking longer than expected to load. Pull to refresh and try again.',
  );
  return (
    offerings.current ??
    Object.values(offerings.all ?? {}).find(
      (offering): offering is PurchasesOffering => Boolean(offering),
    ) ??
    null
  );
}

export async function purchaseRevenueCatPackage(aPackage: PurchasesPackage) {
  return withRevenueCatTimeout(
    Purchases.purchasePackage(aPackage),
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
