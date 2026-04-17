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

function getRevenueCatApiKey() {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RevenueCat is not configured for this build.');
  }

  return apiKey;
}

export function buildMobileRevenueCatAppUserId(businessId: string) {
  return `business:${businessId}`;
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
    await Purchases.logIn(appUserId);
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
  const offerings = await Purchases.getOfferings();
  return (
    offerings.current ??
    Object.values(offerings.all ?? {}).find(
      (offering): offering is PurchasesOffering => Boolean(offering),
    ) ??
    null
  );
}

export async function purchaseRevenueCatPackage(aPackage: PurchasesPackage) {
  return Purchases.purchasePackage(aPackage);
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function presentRevenueCatCustomerCenter() {
  return RevenueCatUI.presentCustomerCenter();
}

export function isRevenueCatPurchaseCancelled(error: unknown) {
  const purchaseError = error as PurchasesError | null;

  return (
    purchaseError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    purchaseError?.userCancelled === true
  );
}
