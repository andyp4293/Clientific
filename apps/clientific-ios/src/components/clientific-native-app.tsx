import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking as NativeLinking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import {
  createMobileService,
  createMobileServiceGroup,
  createMobileStaff,
  createMobileCustomer,
  createMobileCustomerGroup,
  createMobileCheckIn,
  createMobileAppointment,
  ClientificApiError,
  deleteMobileBusinessAccount,
  deleteMobileService,
  deleteMobileServiceGroup,
  deleteMobileStaff,
  deleteMobileAppointment,
  confirmVerificationCode,
  deleteMobileCustomer,
  deleteMobileCustomerGroup,
  fetchMobileAiReceptionist,
  fetchMobileAppointments,
  fetchMobileBilling,
  fetchMobileBusinessHours,
  fetchMobileBusinessProfile,
  fetchMobileCheckIns,
  fetchMobileCustomerDetail,
  fetchMobileCustomerSmsLogs,
  fetchMobileCustomerView,
  fetchMobileCustomers,
  fetchMobileDeals,
  fetchMobileFunds,
  fetchMobileHomeSummary,
  fetchMobileNotifications,
  fetchMobileReferrals,
  fetchMobileReviews,
  fetchMobileServices,
  getClientificWebUrl,
  lookupMobileCheckIn,
  lookupMobileRedemption,
  MobileAiReceptionistSummary,
  MobileAiReceptionistUpdateInput,
  MobileAppointmentInput,
  MobileAppointmentUpdateInput,
  MobileAppointmentsSummary,
  MobileBillingSummary,
  MobileBusinessHoursSummary,
  MobileBusinessProfile,
  MobileCustomerFilters,
  MobileCustomerGroupInput,
  MobileCustomerInput,
  MobileCustomerRecord,
  MobileCheckInSubmissionInput,
  MobileCheckInsSummary,
  MobileCustomerViewSummary,
  MobileCustomersSummary,
  MobileDealRecord,
  MobileDealsSummary,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileLoginResponse,
  MobileNotificationsSummary,
  MobileOnboardingInput,
  MobileRedeemResult,
  MobileReferralsSummary,
  MobileReviewsSummary,
  MobileServiceGroupInput,
  MobileServiceInput,
  MobileServicesSummary,
  MobileStaffInput,
  loginWithClientific,
  markMobileNotificationsRead,
  redeemMobileCode,
  registerMobilePushToken,
  registerWithClientific,
  resendVerificationCode,
  sendMobileReviewRequest,
  sendMobileCustomerMessage,
  syncMobileAppStoreSubscription,
  unregisterMobilePushToken,
  updateMobileAiReceptionist,
  updateMobileAppointment,
  updateMobileBusinessHours,
  updateMobileBusinessProfile,
  updateMobileCustomer,
  updateMobileCustomerGroup,
  updateMobileServiceGroup,
  updateMobileService,
  updateMobileStaff,
  reorderMobileServiceGroups,
  reorderMobileServices,
} from '@/lib/clientific-api';
import { APP_PRIVACY_URL, APP_TERMS_URL } from '@/lib/clientific-brand';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  hasActiveAppStorePurchaseResult,
  isRecoverableAppStoreSyncError,
  resolvePendingAppStoreSyncSnapshot,
} from '@/lib/app-store-sync';
import {
  addPushNotificationResponseListener,
  getMobilePushPermissionStatus,
  registerForPushNotificationsAsync,
} from '@/lib/mobile-push-notifications';
import {
  buildMobileRevenueCatAppUserId,
  clearRevenueCatUser,
  configureRevenueCatForBusiness,
  getCurrentRevenueCatOffering,
  getSafeAppStoreBillingErrorMessage,
  isRevenueCatPurchaseCancelled,
  presentRevenueCatCustomerCenter,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from '@/lib/mobile-subscriptions';
import { buildReferralInviteUrl, resolveReferralCodeInput } from '@/lib/referral-links';
import {
  MobileAppShell,
  type MobileAppTab,
} from '@/components/mobile-app-shell';
import {
  MobileAuthScreen,
  type MobileAuthMode,
  type MobileRegistrationForm,
} from '@/components/mobile-auth-screen';
import type { MobileMoreSection } from '@/components/mobile-more-screen';
import { MobileOnboardingScreen } from '@/components/mobile-onboarding-screen';

const MOBILE_SESSION_TOKEN_KEY = 'clientific.mobile.session.token';

function getReadableError(error: unknown, fallback: string) {
  if (error instanceof ClientificApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function formatMobileDateKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function shiftMobileDateKey(dateKey: string, direction: -1 | 1) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const nextDate = new Date(year, (month || 1) - 1, day || 1);
  nextDate.setDate(nextDate.getDate() + direction);
  return formatMobileDateKey(nextDate);
}

function formatMobileLongDateLabel(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getLocalAppStorePlanCopy(plan: 'starter' | 'pro' | 'premium') {
  switch (plan) {
    case 'starter':
      return {
        name: 'Starter',
        priceLabel: '$39/month',
      };
    case 'pro':
      return {
        name: 'Pro',
        priceLabel: '$69/month',
      };
    case 'premium':
      return {
        name: 'Premium',
        priceLabel: '$99/month',
      };
  }
}

function resolveMobileBillingDeepLink(url: string | null) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\/+/, '').toLowerCase();
    const tab = parsed.searchParams.get('tab')?.toLowerCase() ?? null;
    const section = parsed.searchParams.get('section')?.toLowerCase() ?? null;

    return (
      host === 'billing' ||
      path === 'billing' ||
      tab === 'billing' ||
      section === 'billing' ||
      (tab === 'more' && section === 'billing')
    );
  } catch {
    return false;
  }
}

const SHOULD_OPEN_DEBUG_BILLING_ON_LAUNCH =
  __DEV__ && process.env.EXPO_PUBLIC_MOBILE_DEBUG_INITIAL_SECTION === 'billing';

export function ClientificNativeApp() {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [isBooting, setIsBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<MobileAppTab>('dashboard');
  const [moreSection, setMoreSection] = useState<MobileMoreSection>('menu');
  const [authMode, setAuthMode] = useState<MobileAuthMode>('sign-in');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [isRefreshingHome, setIsRefreshingHome] = useState(false);
  const [isLoadingAiReceptionist, setIsLoadingAiReceptionist] = useState(false);
  const [isRefreshingAiReceptionist, setIsRefreshingAiReceptionist] = useState(false);
  const [isSavingAiReceptionist, setIsSavingAiReceptionist] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [isLoadingAppointmentComposer, setIsLoadingAppointmentComposer] = useState(false);
  const [isRefreshingAppointments, setIsRefreshingAppointments] = useState(false);
  const [isLoadingCheckIns, setIsLoadingCheckIns] = useState(false);
  const [isRefreshingCheckIns, setIsRefreshingCheckIns] = useState(false);
  const [isLoadingCustomerView, setIsLoadingCustomerView] = useState(false);
  const [isRefreshingCustomerView, setIsRefreshingCustomerView] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isRefreshingCustomers, setIsRefreshingCustomers] = useState(false);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);
  const [isRefreshingDeals, setIsRefreshingDeals] = useState(false);
  const [isLoadingBusinessProfile, setIsLoadingBusinessProfile] = useState(false);
  const [isSavingBusinessProfile, setIsSavingBusinessProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [isRefreshingReferrals, setIsRefreshingReferrals] = useState(false);
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);
  const [isRefreshingFunds, setIsRefreshingFunds] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isRefreshingNotifications, setIsRefreshingNotifications] = useState(false);
  const [isMarkingNotificationsRead, setIsMarkingNotificationsRead] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isRefreshingServices, setIsRefreshingServices] = useState(false);
  const [isLoadingBusinessHours, setIsLoadingBusinessHours] = useState(false);
  const [isRefreshingBusinessHours, setIsRefreshingBusinessHours] = useState(false);
  const [isSavingBusinessHours, setIsSavingBusinessHours] = useState(false);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isRefreshingReviews, setIsRefreshingReviews] = useState(false);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isRefreshingBilling, setIsRefreshingBilling] = useState(false);
  const [isLoadingBillingOffering, setIsLoadingBillingOffering] = useState(false);
  const [isPurchasingSubscription, setIsPurchasingSubscription] = useState(false);
  const [isRestoringSubscription, setIsRestoringSubscription] = useState(false);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [aiReceptionistError, setAiReceptionistError] = useState<string | null>(null);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [appointmentComposerError, setAppointmentComposerError] = useState<string | null>(null);
  const [businessProfileError, setBusinessProfileError] = useState<string | null>(null);
  const [checkInsError, setCheckInsError] = useState<string | null>(null);
  const [customerViewError, setCustomerViewError] = useState<string | null>(null);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [dealsError, setDealsError] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [referralsError, setReferralsError] = useState<string | null>(null);
  const [fundsError, setFundsError] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [businessHoursError, setBusinessHoursError] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [billingPurchaseError, setBillingPurchaseError] = useState<string | null>(null);
  const [pendingSubscriptionRedirectMessage, setPendingSubscriptionRedirectMessage] =
    useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [appointmentsDate, setAppointmentsDate] = useState(() => formatMobileDateKey(new Date()));
  const [checkInsDate, setCheckInsDate] = useState(() => formatMobileDateKey(new Date()));
  const [customersPage, setCustomersPage] = useState(1);
  const [customerFilters, setCustomerFilters] = useState<MobileCustomerFilters>({
    group: '',
    sms: '',
    contact: '',
    visit: '',
  });
  const [customersSearchDraft, setCustomersSearchDraft] = useState('');
  const [customersSearchQuery, setCustomersSearchQuery] = useState('');
  const [session, setSession] = useState<MobileLoginResponse | null>(null);
  const [aiReceptionist, setAiReceptionist] = useState<MobileAiReceptionistSummary | null>(null);
  const [appointments, setAppointments] = useState<MobileAppointmentsSummary | null>(null);
  const [appointmentComposerCustomers, setAppointmentComposerCustomers] = useState<
    MobileCustomerRecord[]
  >([]);
  const [businessProfile, setBusinessProfile] = useState<MobileBusinessProfile | null>(null);
  const [checkIns, setCheckIns] = useState<MobileCheckInsSummary | null>(null);
  const [customerView, setCustomerView] = useState<MobileCustomerViewSummary | null>(null);
  const [customers, setCustomers] = useState<MobileCustomersSummary | null>(null);
  const [deals, setDeals] = useState<MobileDealsSummary | null>(null);
  const [home, setHome] = useState<MobileHomeSummary | null>(null);
  const [referrals, setReferrals] = useState<MobileReferralsSummary | null>(null);
  const [funds, setFunds] = useState<MobileFundsSummary | null>(null);
  const [notifications, setNotifications] = useState<MobileNotificationsSummary | null>(null);
  const [services, setServices] = useState<MobileServicesSummary | null>(null);
  const [businessHours, setBusinessHours] = useState<MobileBusinessHoursSummary | null>(null);
  const [reviews, setReviews] = useState<MobileReviewsSummary | null>(null);
  const [billing, setBilling] = useState<MobileBillingSummary | null>(null);
  const [billingOffering, setBillingOffering] = useState<PurchasesOffering | null>(null);
  const [registeredPushToken, setRegisteredPushToken] = useState<string | null>(null);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<
    Awaited<ReturnType<typeof getMobilePushPermissionStatus>>
  >('undetermined');
  const hasAttemptedBillingOfferingLoadRef = useRef(false);

  const openBillingFromDeepLink = useCallback((url: string | null) => {
    if (!resolveMobileBillingDeepLink(url)) {
      return false;
    }

    setActiveTab('more');
    setMoreSection('billing');
    return true;
  }, []);

  async function routeNotificationLink(link: string | null) {
    if (!link) {
      return;
    }

    const normalizedLink = link.toLowerCase();

    if (normalizedLink.includes('/dashboard/appointments')) {
      setActiveTab('appointments');
      if (session?.token) {
        void loadAppointments(session.token, appointmentsDate, true);
      }
      return;
    }

    if (
      resolveMobileBillingDeepLink(link) ||
      normalizedLink.includes('/dashboard/settings/billing')
    ) {
      setActiveTab('more');
      setMoreSection('billing');
      if (session?.token) {
        void loadBilling(session.token, true);
      }
      return;
    }

    if (normalizedLink.includes('/dashboard/reviews')) {
      setActiveTab('more');
      setMoreSection('reviews');
      if (session?.token) {
        void loadReviews(session.token, true);
      }
      return;
    }

    if (normalizedLink.includes('/dashboard/referrals')) {
      setActiveTab('more');
      setMoreSection('referrals');
      if (session?.token) {
        void loadReferrals(session.token, true);
      }
      return;
    }

    if (normalizedLink.includes('/dashboard/funds') || normalizedLink.includes('/dashboard/payout')) {
      setActiveTab('more');
      setMoreSection('payouts');
      if (session?.token) {
        void loadFunds(session.token, true);
      }
      return;
    }

    if (normalizedLink.includes('/dashboard/customers')) {
      setActiveTab('customers');
      if (session?.token) {
        void loadCustomers(
          session.token,
          {
            page: customersPage,
            search: customersSearchQuery,
            filters: customerFilters,
          },
          true,
        );
      }
      return;
    }

    const destination = link.startsWith('http') ? link : `${getClientificWebUrl()}${link}`;
    try {
      await WebBrowser.openBrowserAsync(destination);
    } catch (error) {
      setHomeError(getReadableError(error, 'Unable to open that notification right now.'));
    }
  }

  const signOut = useCallback(async (message?: string) => {
    if (session?.token && registeredPushToken) {
      void unregisterMobilePushToken(session.token, registeredPushToken).catch((error) => {
        console.warn('Unable to unregister mobile push token:', error);
      });
    }

    await clearRevenueCatUser();
    await SecureStore.deleteItemAsync(MOBILE_SESSION_TOKEN_KEY);
    setSession(null);
    setAiReceptionist(null);
    setAppointments(null);
    setAppointmentComposerCustomers([]);
    setBusinessProfile(null);
    setCheckIns(null);
    setCustomerView(null);
    setCustomers(null);
    setDeals(null);
    setHome(null);
    setReferrals(null);
    setFunds(null);
    setNotifications(null);
    setServices(null);
    setBusinessHours(null);
    setReviews(null);
    setBilling(null);
    setBillingOffering(null);
    setPushPermissionStatus('undetermined');
    setRegisteredPushToken(null);
    hasAttemptedBillingOfferingLoadRef.current = false;
    setActiveTab('dashboard');
    setMoreSection('menu');
    setAuthMode('sign-in');
    setAuthError(null);
    setAuthNotice(null);
    setAiReceptionistError(null);
    setAppointmentsError(null);
    setAppointmentComposerError(null);
    setBusinessProfileError(null);
    setCheckInsError(null);
    setCustomerViewError(null);
    setCustomersError(null);
    setDealsError(null);
    setHomeError(null);
    setReferralsError(null);
    setFundsError(null);
    setNotificationsError(null);
    setServicesError(null);
    setBusinessHoursError(null);
    setReviewsError(null);
    setBillingError(null);
    setBillingNotice(null);
    setBillingPurchaseError(null);
    setPendingSubscriptionRedirectMessage(null);
    setIsDeletingAccount(false);
    setAppointmentsDate(formatMobileDateKey(new Date()));
    setCheckInsDate(formatMobileDateKey(new Date()));
    setCustomersPage(1);
    setCustomerFilters({
      group: '',
      sms: '',
      contact: '',
      visit: '',
    });
    setCustomersSearchDraft('');
    setCustomersSearchQuery('');
    setPendingVerification(null);
    setRegisteredPushToken(null);
    if (message) {
      setAuthError(message);
    }
  }, [registeredPushToken, session?.token]);

  const handleSessionError = useCallback(
    async (error: unknown, fallback: string, setError: (message: string | null) => void) => {
      if (error instanceof ClientificApiError && error.status === 401) {
        await signOut('Your mobile session expired. Sign in again.');
        return;
      }

      if (
        error instanceof ClientificApiError &&
        error.status === 403 &&
        error.code === 'SUBSCRIPTION_REQUIRED'
      ) {
        setError(null);
        setPendingSubscriptionRedirectMessage(
          'Start the 14-day App Store trial from Billing to unlock booking, CRM, reminders, analytics, deals, referrals, and secure payouts. Pro and Premium also add AI receptionist phone coverage.',
        );
        return;
      }

      setError(getReadableError(error, fallback));
    },
    [signOut],
  );

  const loadHome = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingHome(true);
      } else {
        setIsLoadingHome(true);
      }

      try {
        const nextHome = await fetchMobileHomeSummary(token);
        setHome(nextHome);
        setSession({ token, business: nextHome.business });
        if (nextHome.business.onboardingComplete) {
          setBusinessProfile(null);
          setBusinessProfileError(null);
        }
        if (nextHome.business.onboardingComplete && nextHome.subscription.requiresPurchase) {
          setActiveTab('more');
          setMoreSection('billing');
          setBillingNotice(
            'Start the 14-day App Store trial to unlock booking, CRM, reminders, analytics, deals, referrals, and secure payouts. Pro and Premium also add AI receptionist phone coverage.',
          );
        } else {
          setBillingNotice(null);
        }
        setHomeError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load your mobile home.', setHomeError);
      } finally {
        if (isRefresh) {
          setIsRefreshingHome(false);
        } else {
          setIsLoadingHome(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadAiReceptionist = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingAiReceptionist(true);
      } else {
        setIsLoadingAiReceptionist(true);
      }

      try {
        const nextAiReceptionist = await fetchMobileAiReceptionist(token);
        setAiReceptionist(nextAiReceptionist);
        setAiReceptionistError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load AI receptionist.',
          setAiReceptionistError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingAiReceptionist(false);
        } else {
          setIsLoadingAiReceptionist(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadAppointments = useCallback(
    async (token: string, date: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingAppointments(true);
      } else {
        setIsLoadingAppointments(true);
      }

      try {
        const nextAppointments = await fetchMobileAppointments(token, { date });
        setAppointments(nextAppointments);
        setAppointmentsError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load your mobile schedule.',
          setAppointmentsError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingAppointments(false);
        } else {
          setIsLoadingAppointments(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadAppointmentComposerResources = useCallback(
    async (token: string) => {
      setIsLoadingAppointmentComposer(true);

      try {
        const [customersResponse, servicesResponse] = await Promise.all([
          fetchMobileCustomers(token, {
            page: 1,
            pageSize: 100,
            search: '',
          }),
          fetchMobileServices(token),
        ]);

        setAppointmentComposerCustomers(customersResponse.customers);
        setServices(servicesResponse);
        setAppointmentComposerError(null);
        setServicesError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load appointment booking resources.',
          setAppointmentComposerError,
        );
      } finally {
        setIsLoadingAppointmentComposer(false);
      }
    },
    [handleSessionError],
  );

  const loadBusinessProfile = useCallback(
    async (token: string) => {
      setIsLoadingBusinessProfile(true);

      try {
        const response = await fetchMobileBusinessProfile(token);
        setBusinessProfile(response.business);
        setBusinessProfileError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load your business setup.',
          setBusinessProfileError,
        );
      } finally {
        setIsLoadingBusinessProfile(false);
      }
    },
    [handleSessionError],
  );

  const loadCustomerView = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingCustomerView(true);
      } else {
        setIsLoadingCustomerView(true);
      }

      try {
        const nextCustomerView = await fetchMobileCustomerView(token);
        setCustomerView(nextCustomerView);
        setCustomerViewError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load customer view.',
          setCustomerViewError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingCustomerView(false);
        } else {
          setIsLoadingCustomerView(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadCheckIns = useCallback(
    async (token: string, date: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingCheckIns(true);
      } else {
        setIsLoadingCheckIns(true);
      }

      try {
        const nextCheckIns = await fetchMobileCheckIns(token, { date });
        setCheckIns(nextCheckIns);
        setCheckInsError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load mobile check-ins.',
          setCheckInsError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingCheckIns(false);
        } else {
          setIsLoadingCheckIns(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadCustomers = useCallback(
    async (
      token: string,
      options: { page: number; search: string; filters: MobileCustomerFilters },
      isRefresh = false,
    ) => {
      if (isRefresh) {
        setIsRefreshingCustomers(true);
      } else {
        setIsLoadingCustomers(true);
      }

      try {
        const nextCustomers = await fetchMobileCustomers(token, {
          page: options.page,
          pageSize: 20,
          search: options.search,
          group: options.filters.group,
          sms: options.filters.sms,
          contact: options.filters.contact,
          visit: options.filters.visit,
        });
        setCustomers(nextCustomers);
        setCustomersError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load mobile customers.',
          setCustomersError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingCustomers(false);
        } else {
          setIsLoadingCustomers(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadDeals = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingDeals(true);
      } else {
        setIsLoadingDeals(true);
      }

      try {
        const nextDeals = await fetchMobileDeals(token);
        setDeals(nextDeals);
        setDealsError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load mobile deals.', setDealsError);
      } finally {
        if (isRefresh) {
          setIsRefreshingDeals(false);
        } else {
          setIsLoadingDeals(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadReferrals = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingReferrals(true);
      } else {
        setIsLoadingReferrals(true);
      }

      try {
        const nextReferrals = await fetchMobileReferrals(token);
        setReferrals(nextReferrals);
        setReferralsError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load referrals.', setReferralsError);
      } finally {
        if (isRefresh) {
          setIsRefreshingReferrals(false);
        } else {
          setIsLoadingReferrals(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadFunds = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingFunds(true);
      } else {
        setIsLoadingFunds(true);
      }

      try {
        const nextFunds = await fetchMobileFunds(token);
        setFunds(nextFunds);
        setFundsError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load funds.', setFundsError);
      } finally {
        if (isRefresh) {
          setIsRefreshingFunds(false);
        } else {
          setIsLoadingFunds(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadNotifications = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingNotifications(true);
      } else {
        setIsLoadingNotifications(true);
      }

      try {
        const nextNotifications = await fetchMobileNotifications(token);
        setNotifications(nextNotifications);
        setNotificationsError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load mobile notifications.',
          setNotificationsError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingNotifications(false);
        } else {
          setIsLoadingNotifications(false);
        }
      }
    },
    [handleSessionError],
  );

  const refreshPushPermissionStatus = useCallback(async () => {
    try {
      const nextStatus = await getMobilePushPermissionStatus();
      setPushPermissionStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      console.warn('Unable to read push notification permission status:', error);
      return 'undetermined' as const;
    }
  }, []);

  const loadServices = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingServices(true);
      } else {
        setIsLoadingServices(true);
      }

      try {
        const nextServices = await fetchMobileServices(token);
        setServices(nextServices);
        setServicesError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load services.', setServicesError);
      } finally {
        if (isRefresh) {
          setIsRefreshingServices(false);
        } else {
          setIsLoadingServices(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadBusinessHours = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingBusinessHours(true);
      } else {
        setIsLoadingBusinessHours(true);
      }

      try {
        const nextBusinessHours = await fetchMobileBusinessHours(token);
        setBusinessHours(nextBusinessHours);
        setBusinessHoursError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load business hours.', setBusinessHoursError);
      } finally {
        if (isRefresh) {
          setIsRefreshingBusinessHours(false);
        } else {
          setIsLoadingBusinessHours(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadReviews = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingReviews(true);
      } else {
        setIsLoadingReviews(true);
      }

      try {
        const nextReviews = await fetchMobileReviews(token);
        setReviews(nextReviews);
        setReviewsError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load reviews.', setReviewsError);
      } finally {
        if (isRefresh) {
          setIsRefreshingReviews(false);
        } else {
          setIsLoadingReviews(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadBilling = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingBilling(true);
      } else {
        setIsLoadingBilling(true);
      }

      try {
        const nextBilling = await fetchMobileBilling(token);
        setBilling(nextBilling);
        setBillingError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load billing.', setBillingError);
      } finally {
        if (isRefresh) {
          setIsRefreshingBilling(false);
        } else {
          setIsLoadingBilling(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadBillingOffering = useCallback(
    async (businessId: string, options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      if (hasAttemptedBillingOfferingLoadRef.current && !force) {
        return;
      }

      hasAttemptedBillingOfferingLoadRef.current = true;
      setIsLoadingBillingOffering(true);

      try {
        await configureRevenueCatForBusiness(businessId);
        const offering = await getCurrentRevenueCatOffering();
        setBillingOffering(offering);
        setBillingPurchaseError(null);
      } catch (error) {
        setBillingOffering(null);
        setBillingPurchaseError(getSafeAppStoreBillingErrorMessage(error));
      } finally {
        setIsLoadingBillingOffering(false);
      }
    },
    [],
  );

  const openBillingPaywall = useCallback(
    (message?: string) => {
      setActiveTab('more');
      setMoreSection('billing');
      if (message) {
        setBillingNotice(message);
      }

      if (session && !billing && !isLoadingBilling) {
        void loadBilling(session.token);
      }

      if (session && !billingOffering && !isLoadingBillingOffering) {
        void loadBillingOffering(session.business.id);
      }
    },
    [
      billing,
      billingOffering,
      isLoadingBilling,
      isLoadingBillingOffering,
      loadBilling,
      loadBillingOffering,
      session,
    ],
  );

  const syncActiveAppStoreSubscription = useCallback(async () => {
    if (!session) {
      throw new Error('Sign in again to continue.');
    }

    const appUserId = buildMobileRevenueCatAppUserId(session.business.id);
    await syncMobileAppStoreSubscription(session.token, { appUserId });
    await Promise.all([
      loadHome(session.token),
      loadBilling(session.token, true),
    ]);
  }, [loadBilling, loadHome, session]);

  const applyPendingAppStoreSyncSnapshot = useCallback(
    (
      customerInfo:
        | Pick<CustomerInfo, 'activeSubscriptions' | 'entitlements' | 'subscriptionsByProductIdentifier' | 'latestExpirationDate'>
        | null
        | undefined,
    ) => {
      const fallbackBusiness = session?.business;
      if (!fallbackBusiness) {
        return false;
      }

      const snapshot = resolvePendingAppStoreSyncSnapshot(customerInfo);
      if (!snapshot) {
        return false;
      }

      const planCopy = getLocalAppStorePlanCopy(snapshot.plan);
      const trialEndsAtLabel = formatMobileLongDateLabel(snapshot.trialEndsAt);
      const nextBillingDateLabel = formatMobileLongDateLabel(
        snapshot.subscriptionCurrentPeriodEnd,
      );

      setHome((current) =>
        current
          ? {
              ...current,
              subscription: {
                plan: snapshot.plan,
                status: snapshot.subscriptionStatus,
                billingProvider: 'app_store',
                isActive: true,
                requiresPurchase: false,
              },
            }
          : current,
      );

      setBilling((current) => ({
        business: current?.business ?? fallbackBusiness,
        currentPlanName: planCopy.name,
        currentPlanPriceLabel: planCopy.priceLabel,
        planSummary:
          'Your App Store subscription is active and managed by Apple. Pull to refresh in a few seconds if invoices or trial dates need a moment to catch up.',
        billingProvider: 'app_store',
        billingProviderLabel: 'App Store',
        managementTitle: 'Manage in the App Store',
        managementSummary:
          'Use the App Store to manage renewals, cancellations, and payment details for this subscription.',
        subscriptionStatus: snapshot.subscriptionStatus,
        subscriptionStatusLabel:
          snapshot.subscriptionStatus === 'trialing' ? 'Trialing' : 'Active',
        isActive: true,
        canPurchaseInApp: false,
        showManageInApp: true,
        trialDaysRemaining:
          snapshot.subscriptionStatus === 'trialing' && snapshot.trialEndsAt
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(snapshot.trialEndsAt).getTime() - Date.now()) /
                    (24 * 60 * 60 * 1000),
                ),
              )
            : null,
        trialEndsAtLabel,
        nextBillingDateLabel,
        paymentMethodSummary: 'Billing is managed by Apple.',
        invoiceEmptyState:
          'Receipts and renewal details are managed in your App Store account.',
        paymentMethod: null,
        invoices: current?.invoices ?? [],
      }));

      return true;
    },
    [session?.business],
  );

  const handlePurchaseSubscription = useCallback(
    async (aPackage: PurchasesPackage) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      let purchaseResult:
        | Awaited<ReturnType<typeof purchaseRevenueCatPackage>>
        | null = null;

      setIsPurchasingSubscription(true);
      setBillingPurchaseError(null);
      setBillingNotice(null);

      try {
        await configureRevenueCatForBusiness(session.business.id);
        purchaseResult = await purchaseRevenueCatPackage(aPackage);
        await syncActiveAppStoreSubscription();
      } catch (error) {
        if (
          hasActiveAppStorePurchaseResult(purchaseResult) &&
          isRecoverableAppStoreSyncError(error) &&
          applyPendingAppStoreSyncSnapshot(purchaseResult?.customerInfo)
        ) {
          setBillingNotice(
            'Your App Store purchase went through and is still syncing. Pull to refresh in a few seconds if your plan does not unlock right away.',
          );
          return;
        }

      if (isRevenueCatPurchaseCancelled(error)) {
        return;
      }

        setBillingPurchaseError(
          getSafeAppStoreBillingErrorMessage(
            error,
            'Unable to complete the App Store purchase right now.',
          ),
        );
      } finally {
        setIsPurchasingSubscription(false);
      }
    },
    [applyPendingAppStoreSyncSnapshot, session, syncActiveAppStoreSubscription],
  );

  const handleRestoreSubscription = useCallback(async () => {
    if (!session) {
      throw new Error('Sign in again to continue.');
    }

    let restoreResult:
      | Awaited<ReturnType<typeof restoreRevenueCatPurchases>>
      | null = null;

    setIsRestoringSubscription(true);
    setBillingPurchaseError(null);

    try {
      await configureRevenueCatForBusiness(session.business.id);
      restoreResult = await restoreRevenueCatPurchases();
      await syncActiveAppStoreSubscription();
      setBillingNotice('App Store purchases restored.');
    } catch (error) {
      if (
        hasActiveAppStorePurchaseResult(restoreResult) &&
        isRecoverableAppStoreSyncError(error) &&
        applyPendingAppStoreSyncSnapshot(restoreResult)
      ) {
        setBillingNotice(
          'Your App Store purchases are still syncing. Pull to refresh in a few seconds if your plan does not unlock right away.',
        );
        return;
      }

      setBillingPurchaseError(
        getSafeAppStoreBillingErrorMessage(
          error,
          'Unable to restore App Store purchases right now.',
        ),
      );
    } finally {
      setIsRestoringSubscription(false);
    }
  }, [applyPendingAppStoreSyncSnapshot, session, syncActiveAppStoreSubscription]);

  const handleOpenCustomerCenter = useCallback(async () => {
    if (!session) {
      throw new Error('Sign in again to continue.');
    }

    setIsManagingSubscription(true);
    setBillingPurchaseError(null);

    try {
      await configureRevenueCatForBusiness(session.business.id);
      await presentRevenueCatCustomerCenter();
      await Promise.all([
        loadHome(session.token),
        loadBilling(session.token, true),
      ]);
    } catch (error) {
      setBillingPurchaseError(
        getSafeAppStoreBillingErrorMessage(
          error,
          'Unable to open App Store subscription management right now.',
        ),
      );
    } finally {
      setIsManagingSubscription(false);
    }
  }, [loadBilling, loadHome, session]);

  const handleChangeMoreSection = useCallback(
    (nextSection: MobileMoreSection) => {
      const subscriptionLocked = home?.subscription.requiresPurchase ?? false;
      const unlockedSections: MobileMoreSection[] = ['menu', 'settings', 'billing'];

      if (subscriptionLocked && !unlockedSections.includes(nextSection)) {
        openBillingPaywall(
          'Finish setup in Billing first. Start the 14-day App Store trial to unlock booking, CRM, reminders, analytics, deals, referrals, and secure payouts. Pro and Premium also add AI receptionist phone coverage.',
        );
        return;
      }

      if (nextSection === 'payouts' && session && !funds && !isLoadingFunds) {
        setIsLoadingFunds(true);
        void loadFunds(session.token);
      }

      setMoreSection(nextSection);
    },
    [funds, home?.subscription.requiresPurchase, isLoadingFunds, loadFunds, openBillingPaywall, session],
  );

  const openFundsTab = useCallback(() => {
    if (home?.subscription.requiresPurchase) {
      openBillingPaywall();
      return;
    }

    setActiveTab('more');
    handleChangeMoreSection('payouts');
  }, [handleChangeMoreSection, home?.subscription.requiresPurchase, openBillingPaywall]);

  const openReferralsTab = useCallback(() => {
    if (home?.subscription.requiresPurchase) {
      openBillingPaywall();
      return;
    }

    setMoreSection('referrals');
    setActiveTab('more');
    if (session && !referrals && !isLoadingReferrals) {
      void loadReferrals(session.token);
    }
  }, [
    home?.subscription.requiresPurchase,
    isLoadingReferrals,
    loadReferrals,
    openBillingPaywall,
    referrals,
    session,
  ]);

  const openAppointmentsTab = useCallback(() => {
    if (home?.subscription.requiresPurchase) {
      openBillingPaywall();
      return;
    }

    setActiveTab('appointments');
    if (
      session &&
      (!appointments || appointments.selectedDate !== appointmentsDate) &&
      !isLoadingAppointments
    ) {
      void loadAppointments(session.token, appointmentsDate);
    }
  }, [
    appointments,
    appointmentsDate,
    home?.subscription.requiresPurchase,
    isLoadingAppointments,
    loadAppointments,
    openBillingPaywall,
    session,
  ]);

  const openCheckInsTab = useCallback(() => {
    if (home?.subscription.requiresPurchase) {
      openBillingPaywall();
      return;
    }

    setMoreSection('checkins');
    setActiveTab('more');
    if (session && (!checkIns || checkIns.selectedDate !== checkInsDate) && !isLoadingCheckIns) {
      void loadCheckIns(session.token, checkInsDate);
    }
  }, [
    checkIns,
    checkInsDate,
    home?.subscription.requiresPurchase,
    isLoadingCheckIns,
    loadCheckIns,
    openBillingPaywall,
    session,
  ]);

  const openCustomersTab = useCallback(() => {
    if (home?.subscription.requiresPurchase) {
      openBillingPaywall();
      return;
    }

    setActiveTab('customers');
    if (
      session &&
      (!customers ||
        customers.currentPage !== customersPage ||
        customers.search !== customersSearchQuery ||
        customers.filters.group !== customerFilters.group ||
        customers.filters.sms !== customerFilters.sms ||
        customers.filters.contact !== customerFilters.contact ||
        customers.filters.visit !== customerFilters.visit) &&
      !isLoadingCustomers
    ) {
      void loadCustomers(
        session.token,
        {
          page: customersPage,
          search: customersSearchQuery,
          filters: customerFilters,
        },
      );
    }
  }, [
    customerFilters,
    customers,
    customersPage,
    customersSearchQuery,
    home?.subscription.requiresPurchase,
    isLoadingCustomers,
    loadCustomers,
    openBillingPaywall,
    session,
  ]);

  const openDealsTab = useCallback(() => {
    if (home?.subscription.requiresPurchase) {
      openBillingPaywall();
      return;
    }

    setActiveTab('deals');
    if (session && !deals && !isLoadingDeals) {
      void loadDeals(session.token);
    }
  }, [deals, home?.subscription.requiresPurchase, isLoadingDeals, loadDeals, openBillingPaywall, session]);

  const handleChangeTab = useCallback(
    (nextTab: MobileAppTab) => {
      if (nextTab !== 'dashboard' && nextTab !== 'more' && home?.subscription.requiresPurchase) {
        openBillingPaywall();
        return;
      }

      setActiveTab(nextTab);
    },
    [home?.subscription.requiresPurchase, openBillingPaywall],
  );

  const shareCustomerViewLink = useCallback(
    async (label: string, url: string) => {
      try {
        await Share.share({
          message: `${session?.business.name ?? 'Clientific'} ${label}: ${url}`,
        });
        setCustomerViewError(null);
      } catch (error) {
        setCustomerViewError(getReadableError(error, 'Unable to share that link.'));
      }
    },
    [session?.business.name],
  );

  const shareReferral = useCallback(async () => {
    if (!referrals?.payoutReady || !referrals.referralCode) {
      return;
    }

    try {
      const referralUrl = buildReferralInviteUrl(referrals.referralCode);
      await Share.share({
        message: `${session?.business.name ?? 'Clientific'} invited you to join Clientific. Start here: ${referralUrl}`,
      });
      setReferralsError(null);
    } catch (error) {
      setReferralsError(getReadableError(error, 'Unable to open the share sheet.'));
    }
  }, [referrals, session?.business.name]);

  const shareDeal = useCallback(
    async (deal: MobileDealRecord) => {
      try {
        const dealUrl = `${getClientificWebUrl()}${deal.linkPath}`;
        await Share.share({
          message: `${session?.business.name ?? 'Clientific'} deal: ${deal.title}\n${dealUrl}`,
        });
        setDealsError(null);
      } catch (error) {
        setDealsError(getReadableError(error, 'Unable to share this deal.'));
      }
    },
    [session?.business.name],
  );

  const shareReviewSurvey = useCallback(async () => {
    if (!reviews?.surveyUrl) {
      return;
    }

    try {
      await Share.share({
        message: `${session?.business.name ?? 'Clientific'} feedback link: ${reviews.surveyUrl}`,
      });
      setReviewsError(null);
    } catch (error) {
      setReviewsError(getReadableError(error, 'Unable to share the survey link.'));
    }
  }, [reviews?.surveyUrl, session?.business.name]);

  const handleSaveAiReceptionist = useCallback(
    async (input: MobileAiReceptionistUpdateInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      setIsSavingAiReceptionist(true);
      setAiReceptionistError(null);

      try {
        const response = await updateMobileAiReceptionist(session.token, input);
        setAiReceptionist(response);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to save AI receptionist.',
          setAiReceptionistError,
        );
        throw new Error(getReadableError(error, 'Unable to save AI receptionist.'));
      } finally {
        setIsSavingAiReceptionist(false);
      }
    },
    [handleSessionError, session],
  );

  const handleLookupRedeemCode = useCallback(
    async (code: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        return await lookupMobileRedemption(session.token, code);
      } catch (error) {
        throw new Error(getReadableError(error, 'Unable to look up that code.'));
      }
    },
    [session],
  );

  const handleRedeemCode = useCallback(
    async (input: { code: string; transactionAmount?: number | null }) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        const result = await redeemMobileCode(session.token, input);
        await Promise.all([
          deals ? loadDeals(session.token) : Promise.resolve(),
          loadHome(session.token),
        ]);
        return result as MobileRedeemResult;
      } catch (error) {
        throw new Error(getReadableError(error, 'Unable to redeem that code.'));
      }
    },
    [deals, loadDeals, loadHome, session],
  );

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const token = await SecureStore.getItemAsync(MOBILE_SESSION_TOKEN_KEY);
        if (!token) {
          return;
        }

        const nextHome = await fetchMobileHomeSummary(token);
        if (!isActive) {
          return;
        }

        setHome(nextHome);
        setSession({ token, business: nextHome.business });
        setAuthMode('sign-in');
        setAuthNotice(null);
      } catch (error) {
        const isExpiredSession =
          error instanceof ClientificApiError && error.status === 401;

        if (isExpiredSession) {
          await SecureStore.deleteItemAsync(MOBILE_SESSION_TOKEN_KEY);
        } else if (isActive) {
          setAuthError(getReadableError(error, 'Unable to reopen your mobile session.'));
        }
      } finally {
        if (isActive) {
          setIsBooting(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    hasAttemptedBillingOfferingLoadRef.current = false;
  }, [session?.business.id]);

  useEffect(() => {
    void refreshPushPermissionStatus();
  }, [refreshPushPermissionStatus]);

  useEffect(() => {
    let isMounted = true;

    void Linking.getInitialURL().then((url) => {
      if (!isMounted) {
        return;
      }

      openBillingFromDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      openBillingFromDeepLink(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [openBillingFromDeepLink]);

  useEffect(() => {
    if (!SHOULD_OPEN_DEBUG_BILLING_ON_LAUNCH) {
      return;
    }

    openBillingFromDeepLink('clientific://app?tab=more&section=billing');
  }, [openBillingFromDeepLink]);

  useEffect(() => {
    if (!session?.business.id) {
      return;
    }

    void configureRevenueCatForBusiness(session.business.id).catch((error) => {
      console.warn('RevenueCat configuration failed:', error);
      setBillingPurchaseError(getSafeAppStoreBillingErrorMessage(error));
    });
  }, [session?.business.id]);

  useEffect(() => {
    if (!pendingSubscriptionRedirectMessage || !session) {
      return;
    }

    setActiveTab('more');
    setMoreSection('billing');
    setBillingNotice(pendingSubscriptionRedirectMessage);
    setPendingSubscriptionRedirectMessage(null);

    if (!billing && !isLoadingBilling) {
      void loadBilling(session.token);
    }

    if (!billingOffering && !isLoadingBillingOffering) {
      void loadBillingOffering(session.business.id);
    }
  }, [
    billing,
    billingOffering,
    isLoadingBilling,
    isLoadingBillingOffering,
    loadBilling,
    loadBillingOffering,
    pendingSubscriptionRedirectMessage,
    session,
  ]);

  useEffect(() => {
    if (!home?.subscription.requiresPurchase) {
      return;
    }

    if (activeTab === 'appointments' || activeTab === 'customers' || activeTab === 'deals') {
      openBillingPaywall(
        'Your business tools are locked until you start the 14-day App Store trial.',
      );
    }
  }, [activeTab, home?.subscription.requiresPurchase, openBillingPaywall]);

  useEffect(() => {
    if (!home?.subscription.requiresPurchase || activeTab !== 'more') {
      return;
    }

    const lockedSections = new Set<MobileMoreSection>([
      'services',
      'checkins',
      'redeem',
      'hours',
      'aiReceptionist',
      'customerView',
      'reviews',
      'referrals',
      'payouts',
    ]);

    if (lockedSections.has(moreSection)) {
      openBillingPaywall(
        'Finish setup in Billing first. Start the 14-day App Store trial to unlock booking, CRM, reminders, analytics, deals, referrals, and secure payouts. Pro and Premium also add AI receptionist phone coverage.',
      );
    }
  }, [activeTab, home?.subscription.requiresPurchase, moreSection, openBillingPaywall]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    const sessionToken = session.token;
    let isActive = true;

    async function registerDeviceForPush() {
      try {
        await refreshPushPermissionStatus();
        const registration = await registerForPushNotificationsAsync();
        if (!registration || !isActive) {
          if (isActive) {
            const nextStatus = await refreshPushPermissionStatus();
            setPushPermissionStatus(nextStatus);
          }
          return;
        }

        await registerMobilePushToken(sessionToken, registration);
        if (isActive) {
          setRegisteredPushToken(registration.token);
          setPushPermissionStatus('granted');
        }
      } catch (error) {
        console.warn('Mobile push registration failed:', error);
      }
    }

    void registerDeviceForPush();

    return () => {
      isActive = false;
    };
  }, [refreshPushPermissionStatus, session?.token]);

  useEffect(() => {
    const subscription = addPushNotificationResponseListener((response) => {
      const link = response.notification.request.content.data?.link;
      if (typeof link !== 'string') {
        return;
      }

      void routeNotificationLink(link);
      if (session?.token) {
        void loadNotifications(session.token, true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadNotifications, session?.token]);

  const establishSession = useCallback(
    async (email: string, password: string) => {
      const nextSession = await loginWithClientific({ email, password });
      await SecureStore.setItemAsync(MOBILE_SESSION_TOKEN_KEY, nextSession.token);
      setSession(nextSession);
      setAuthMode('sign-in');
      setPendingVerification(null);
      setAuthNotice(null);
      setActiveTab('dashboard');
      setMoreSection('menu');
      await loadHome(nextSession.token);
    },
    [loadHome],
  );

  const handleLogin = useCallback(async (email: string, password: string) => {
    setIsSubmittingAuth(true);
    setAuthError(null);
    setAuthNotice(null);
    setAppointmentsError(null);
    setBusinessProfileError(null);
    setCheckInsError(null);
    setCustomersError(null);
    setDealsError(null);
    setHomeError(null);
    setReferralsError(null);
    setFundsError(null);

    try {
      await establishSession(email.trim(), password);
    } catch (error) {
      if (
        error instanceof ClientificApiError &&
        error.status === 403 &&
        error.message === 'EmailNotVerified'
      ) {
        setPendingVerification({
          email: email.trim().toLowerCase(),
          password,
        });
        setAuthMode('verify');
        setAuthError('Enter the 6-digit code from your email to finish signing in.');
      } else {
        setAuthError(getReadableError(error, 'Unable to sign in right now.'));
      }
    } finally {
      setIsSubmittingAuth(false);
      setIsBooting(false);
    }
  }, [establishSession]);

  const handleRegister = useCallback(async (input: MobileRegistrationForm) => {
    const trimmedEmail = input.email.trim().toLowerCase();
    const trimmedBusinessName = input.businessName.trim();

    if (!trimmedBusinessName) {
      setAuthError('Business name is required.');
      return;
    }

    if (!trimmedEmail) {
      setAuthError('Email is required.');
      return;
    }

    if (input.password.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    if (!/[0-9]/.test(input.password)) {
      setAuthError('Password must include a number.');
      return;
    }

    if (!/[!@#$%^&*]/.test(input.password)) {
      setAuthError('Password must include a special character.');
      return;
    }

    if (input.password !== input.confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    if (!input.acceptTerms) {
      setAuthError('You need to accept the terms to continue.');
      return;
    }

    const referralResolution = resolveReferralCodeInput(input.referralCode);
    if (referralResolution.error) {
      setAuthError(referralResolution.error);
      return;
    }

    setIsSubmittingAuth(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      const response = await registerWithClientific({
        businessName: trimmedBusinessName,
        businessType: input.businessType,
        email: trimmedEmail,
        password: input.password,
        referralCode: referralResolution.referralCode,
      });

      setPendingVerification({
        email: trimmedEmail,
        password: input.password,
      });
      setAuthMode('verify');
      setAuthNotice(
        response.verificationEmailSent
          ? 'Account created. Check your email for the verification code.'
          : 'Account created. Use resend below if the verification code did not arrive.',
      );
    } catch (error) {
      setAuthError(getReadableError(error, 'Unable to create your account right now.'));
    } finally {
      setIsSubmittingAuth(false);
    }
  }, []);

  const handleVerifyCode = useCallback(
    async (email: string, code: string) => {
      const trimmedCode = code.replace(/\D/g, '');
      const verifiedEmail = email.trim().toLowerCase();

      if (trimmedCode.length !== 6) {
        setAuthError('Enter the 6-digit verification code.');
        return;
      }

      setIsSubmittingAuth(true);
      setAuthError(null);
      setAuthNotice(null);

      try {
        await confirmVerificationCode({ email: verifiedEmail, code: trimmedCode });

        if (!pendingVerification?.password || pendingVerification.email !== verifiedEmail) {
          setAuthMode('sign-in');
          setAuthNotice('Email verified. Sign in to continue.');
          return;
        }

        await establishSession(verifiedEmail, pendingVerification.password);
      } catch (error) {
        setAuthError(getReadableError(error, 'Unable to verify your email right now.'));
      } finally {
        setIsSubmittingAuth(false);
      }
    },
    [establishSession, pendingVerification],
  );

  const handleResendCode = useCallback(async (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setAuthError('Add your email address first.');
      return;
    }

    setIsResendingCode(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      await resendVerificationCode(trimmedEmail);
      setAuthNotice('If your account is waiting for verification, a new code is on the way.');
    } catch (error) {
      setAuthError(getReadableError(error, 'Unable to resend the verification code.'));
    } finally {
      setIsResendingCode(false);
    }
  }, []);

  const handleSaveBusinessProfile = useCallback(
    async (input: MobileOnboardingInput) => {
      if (!session) {
        return;
      }

      setIsSavingBusinessProfile(true);
      setBusinessProfileError(null);

      try {
        const response = await updateMobileBusinessProfile(session.token, input);
        setBusinessProfile(response.business);
        await loadHome(session.token);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to save your business setup.',
          setBusinessProfileError,
        );
      } finally {
        setIsSavingBusinessProfile(false);
      }
    },
    [handleSessionError, loadHome, session],
  );

  const handleDeleteAccount = useCallback(async () => {
    if (!session) {
      return;
    }

    setIsDeletingAccount(true);
    setBusinessProfileError(null);

    try {
      if (registeredPushToken) {
        await unregisterMobilePushToken(session.token, registeredPushToken).catch((error) => {
          console.warn('Unable to unregister mobile push token before deletion:', error);
        });
      }

      await deleteMobileBusinessAccount(session.token);
      await signOut();
      setAuthNotice('Your account and business data were permanently deleted.');
      setAuthError(null);
    } catch (error) {
      if (error instanceof ClientificApiError && error.status === 401) {
        await signOut('Your mobile session expired. Sign in again.');
        return;
      }

      setBusinessProfileError(
        getReadableError(error, 'Unable to delete your account right now.'),
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }, [registeredPushToken, session, signOut]);

  const handleSaveBusinessHours = useCallback(
    async (input: {
      hours: Array<{
        dayOfWeek: number;
        isOpen: boolean;
        openTime: string | null;
        closeTime: string | null;
      }>;
      closures: Array<{
        date: string;
        label?: string | null;
      }>;
    }) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      setIsSavingBusinessHours(true);
      setBusinessHoursError(null);

      try {
        const response = await updateMobileBusinessHours(session.token, input);
        setBusinessHours(response);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to save business hours.',
          setBusinessHoursError,
        );
        throw new Error(getReadableError(error, 'Unable to save business hours.'));
      } finally {
        setIsSavingBusinessHours(false);
      }
    },
    [handleSessionError, session],
  );

  const handleRefreshHome = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadHome(session.token, true);
  }, [loadHome, session]);

  const handleRefreshAiReceptionist = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadAiReceptionist(session.token, true);
  }, [loadAiReceptionist, session]);

  const handleRefreshAppointments = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadAppointments(session.token, appointmentsDate, true);
  }, [appointmentsDate, loadAppointments, session]);

  const handleRefreshCheckIns = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadCheckIns(session.token, checkInsDate, true);
  }, [checkInsDate, loadCheckIns, session]);

  const handleRefreshCustomerView = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadCustomerView(session.token, true);
  }, [loadCustomerView, session]);

  const handleRefreshCustomers = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadCustomers(
      session.token,
      {
        page: customersPage,
        search: customersSearchQuery,
        filters: customerFilters,
      },
      true,
    );
  }, [customerFilters, customersPage, customersSearchQuery, loadCustomers, session]);

  const handleRefreshDeals = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadDeals(session.token, true);
  }, [loadDeals, session]);

  const handleRefreshReferrals = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadReferrals(session.token, true);
  }, [loadReferrals, session]);

  const handleRefreshFunds = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadFunds(session.token, true);
  }, [loadFunds, session]);

  const handleRefreshNotifications = useCallback(async () => {
    if (!session) {
      return;
    }

    await Promise.all([
      loadNotifications(session.token, true),
      refreshPushPermissionStatus(),
    ]);
  }, [loadNotifications, refreshPushPermissionStatus, session]);

  const handleMarkNotificationsRead = useCallback(async () => {
    if (!session) {
      return;
    }

    setIsMarkingNotificationsRead(true);
    try {
      await markMobileNotificationsRead(session.token);
      await loadNotifications(session.token, true);
    } catch (error) {
      await handleSessionError(
        error,
        'Unable to mark notifications as read.',
        setNotificationsError,
      );
    } finally {
      setIsMarkingNotificationsRead(false);
    }
  }, [handleSessionError, loadNotifications, session]);

  const handleEnablePushNotifications = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    try {
      setNotificationsError(null);

      if (pushPermissionStatus === 'denied') {
        await NativeLinking.openSettings();
        await refreshPushPermissionStatus();
        return;
      }

      if (!Device.isDevice) {
        setNotificationsError(
          'Push notifications need a physical iPhone or iPad. The iOS simulator can open the setup flow, but it cannot receive permission prompts or live push alerts.',
        );
        await refreshPushPermissionStatus();
        return;
      }

      const registration = await registerForPushNotificationsAsync();
      if (!registration) {
        await refreshPushPermissionStatus();
        return;
      }

      await registerMobilePushToken(session.token, registration);
      setRegisteredPushToken(registration.token);
      setPushPermissionStatus('granted');
      setNotificationsError(null);
    } catch (error) {
      setNotificationsError(
        getReadableError(error, 'Unable to enable notifications on this phone right now.'),
      );
    }
  }, [pushPermissionStatus, refreshPushPermissionStatus, session]);

  const handleOpenNotification = useCallback(
    async (notificationId: string) => {
      if (!notifications) {
        return;
      }

      const notification = notifications.notifications.find((entry) => entry.id === notificationId);
      if (!notification) {
        return;
      }

      await routeNotificationLink(notification.link);
      if (!notification.read && session?.token) {
        await markMobileNotificationsRead(session.token);
        await loadNotifications(session.token, true);
      }
    },
    [loadNotifications, notifications, session],
  );

  const handleRefreshServices = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadServices(session.token, true);
  }, [loadServices, session]);

  const handleRefreshBusinessHours = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadBusinessHours(session.token, true);
  }, [loadBusinessHours, session]);

  const handleRefreshReviews = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadReviews(session.token, true);
  }, [loadReviews, session]);

  const handleRefreshBilling = useCallback(async () => {
    if (!session) {
      return;
    }

    const refreshTasks: Promise<unknown>[] = [loadBilling(session.token, true)];

    if (home?.subscription.requiresPurchase) {
      refreshTasks.push(loadBillingOffering(session.business.id, { force: true }));
    }

    await Promise.all(refreshTasks);
  }, [home?.subscription.requiresPurchase, loadBilling, loadBillingOffering, session]);

  const handleRefreshBusinessProfile = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadBusinessProfile(session.token);
  }, [loadBusinessProfile, session]);

  const handleOpenExternalUrl = useCallback(async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      setHomeError(getReadableError(error, 'Unable to open that link right now.'));
    }
  }, []);

  const goToPreviousAppointmentsDate = useCallback(() => {
    setAppointmentsDate((currentValue) => shiftMobileDateKey(currentValue, -1));
  }, []);

  const goToNextAppointmentsDate = useCallback(() => {
    setAppointmentsDate((currentValue) => shiftMobileDateKey(currentValue, 1));
  }, []);

  const jumpAppointmentsToToday = useCallback(() => {
    setAppointmentsDate(formatMobileDateKey(new Date()));
  }, []);

  const selectAppointmentsDate = useCallback((dateKey: string) => {
    setAppointmentsDate(dateKey);
  }, []);

  const goToPreviousCheckInsDate = useCallback(() => {
    setCheckInsDate((currentValue) => shiftMobileDateKey(currentValue, -1));
  }, []);

  const goToNextCheckInsDate = useCallback(() => {
    setCheckInsDate((currentValue) => shiftMobileDateKey(currentValue, 1));
  }, []);

  const jumpCheckInsToToday = useCallback(() => {
    setCheckInsDate(formatMobileDateKey(new Date()));
  }, []);

  const selectCheckInsDate = useCallback((dateKey: string) => {
    setCheckInsDate(dateKey);
  }, []);

  const goToPreviousCustomersPage = useCallback(() => {
    setCustomersPage((currentPage) => Math.max(1, currentPage - 1));
  }, []);

  const goToNextCustomersPage = useCallback(() => {
    setCustomersPage((currentPage) => {
      const totalPages = customers?.totalPages ?? currentPage + 1;
      return currentPage < totalPages ? currentPage + 1 : currentPage;
    });
  }, [customers?.totalPages]);

  const goToCustomersPage = useCallback((page: number) => {
    setCustomersPage((currentPage) => {
      const totalPages = customers?.totalPages ?? currentPage;
      const nextPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
      return nextPage === currentPage ? currentPage : nextPage;
    });
  }, [customers?.totalPages]);

  const changeCustomerFilters = useCallback((next: Partial<MobileCustomerFilters>) => {
    setCustomersPage(1);
    setCustomerFilters((current) => ({
      ...current,
      ...next,
    }));
  }, []);

  const handleCreateAppointmentCustomer = useCallback(
    async (input: MobileCustomerInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        const response = await createMobileCustomer(session.token, input);
        setAppointmentComposerCustomers((current) => {
          const existing = current.find((customer) => customer.id === response.customer.id);
          if (existing) {
            return current.map((customer) =>
              customer.id === response.customer.id ? response.customer : customer,
            );
          }

          return [response.customer, ...current];
        });

        if (customers) {
          await loadCustomers(session.token, {
            page: customersPage,
            search: customersSearchQuery,
            filters: customerFilters,
          });
        }
        await loadHome(session.token);
        return response.customer;
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to create the appointment customer.',
          setAppointmentComposerError,
        );
        throw new Error(getReadableError(error, 'Unable to create the appointment customer.'));
      }
    },
    [
      customerFilters,
      customers,
      customersPage,
      customersSearchQuery,
      handleSessionError,
      loadCustomers,
      loadHome,
      session,
    ],
  );

  const handleCreateAppointment = useCallback(
    async (input: MobileAppointmentInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await createMobileAppointment(session.token, input);
        await Promise.all([
          loadAppointments(session.token, appointmentsDate, true),
          loadHome(session.token),
          customers
            ? loadCustomers(session.token, {
                page: customersPage,
                search: customersSearchQuery,
                filters: customerFilters,
              })
            : Promise.resolve(),
        ]);
      } catch (error) {
        await handleSessionError(error, 'Unable to create the appointment.', setAppointmentsError);
        throw new Error(getReadableError(error, 'Unable to create the appointment.'));
      }
    },
    [
      appointmentsDate,
      customerFilters,
      customers,
      customersPage,
      customersSearchQuery,
      handleSessionError,
      loadAppointments,
      loadCustomers,
      loadHome,
      session,
    ],
  );

  const handleUpdateAppointment = useCallback(
    async (appointmentId: string, input: MobileAppointmentUpdateInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await updateMobileAppointment(session.token, appointmentId, input);
        await Promise.all([
          loadAppointments(session.token, appointmentsDate, true),
          loadHome(session.token),
          customers
            ? loadCustomers(session.token, {
                page: customersPage,
                search: customersSearchQuery,
                filters: customerFilters,
              })
            : Promise.resolve(),
        ]);
      } catch (error) {
        await handleSessionError(error, 'Unable to update the appointment.', setAppointmentsError);
        throw new Error(getReadableError(error, 'Unable to update the appointment.'));
      }
    },
    [
      appointmentsDate,
      customerFilters,
      customers,
      customersPage,
      customersSearchQuery,
      handleSessionError,
      loadAppointments,
      loadCustomers,
      loadHome,
      session,
    ],
  );

  const handleDeleteAppointment = useCallback(
    async (appointmentId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await deleteMobileAppointment(session.token, appointmentId);
        await Promise.all([
          loadAppointments(session.token, appointmentsDate, true),
          loadHome(session.token),
          customers
            ? loadCustomers(session.token, {
                page: customersPage,
                search: customersSearchQuery,
                filters: customerFilters,
              })
            : Promise.resolve(),
        ]);
      } catch (error) {
        await handleSessionError(error, 'Unable to cancel the appointment.', setAppointmentsError);
        throw new Error(getReadableError(error, 'Unable to cancel the appointment.'));
      }
    },
    [
      appointmentsDate,
      customerFilters,
      customers,
      customersPage,
      customersSearchQuery,
      handleSessionError,
      loadAppointments,
      loadCustomers,
      loadHome,
      session,
    ],
  );

  const handleCreateCustomer = useCallback(
    async (input: MobileCustomerInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await createMobileCustomer(session.token, input);
        await Promise.all([
          loadCustomers(session.token, {
            page: 1,
            search: customersSearchQuery,
            filters: customerFilters,
          }),
          loadHome(session.token),
        ]);
        setCustomersPage(1);
      } catch (error) {
        await handleSessionError(error, 'Unable to create customer.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to create customer.'));
      }
    },
    [customerFilters, customersSearchQuery, handleSessionError, loadCustomers, loadHome, session],
  );

  const handleFetchCustomerDetail = useCallback(
    async (customerId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        const response = await fetchMobileCustomerDetail(session.token, customerId);
        return response.customer;
      } catch (error) {
        await handleSessionError(error, 'Unable to load the customer profile.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to load the customer profile.'));
      }
    },
    [handleSessionError, session],
  );

  const handleUpdateCustomer = useCallback(
    async (customerId: string, input: MobileCustomerInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        const response = await updateMobileCustomer(session.token, customerId, input);
        await Promise.all([
          loadCustomers(session.token, {
            page: customersPage,
            search: customersSearchQuery,
            filters: customerFilters,
          }),
          loadHome(session.token),
        ]);
        return response.customer;
      } catch (error) {
        await handleSessionError(error, 'Unable to update customer.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to update customer.'));
      }
    },
    [
      customerFilters,
      customersPage,
      customersSearchQuery,
      handleSessionError,
      loadCustomers,
      loadHome,
      session,
    ],
  );

  const handleDeleteCustomer = useCallback(
    async (customerId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await deleteMobileCustomer(session.token, customerId);
        await Promise.all([
          loadCustomers(session.token, {
            page: customersPage,
            search: customersSearchQuery,
            filters: customerFilters,
          }),
          loadHome(session.token),
        ]);
      } catch (error) {
        await handleSessionError(error, 'Unable to delete customer.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to delete customer.'));
      }
    },
    [
      customerFilters,
      customersPage,
      customersSearchQuery,
      handleSessionError,
      loadCustomers,
      loadHome,
      session,
    ],
  );

  const handleFetchCustomerMessages = useCallback(
    async (customerId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        return await fetchMobileCustomerSmsLogs(session.token, customerId);
      } catch (error) {
        await handleSessionError(error, 'Unable to load message history.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to load message history.'));
      }
    },
    [handleSessionError, session],
  );

  const handleSendCustomerMessage = useCallback(
    async (customerId: string, message: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await sendMobileCustomerMessage(session.token, customerId, message);
      } catch (error) {
        await handleSessionError(error, 'Unable to send the message.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to send the message.'));
      }
    },
    [handleSessionError, session],
  );

  const handleSendCustomerReviewRequest = useCallback(
    async (customerId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await sendMobileReviewRequest(session.token, customerId);
      } catch (error) {
        await handleSessionError(error, 'Unable to send the review request.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to send the review request.'));
      }
    },
    [handleSessionError, session],
  );

  const handleCreateCustomerGroup = useCallback(
    async (input: MobileCustomerGroupInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await createMobileCustomerGroup(session.token, input);
        await loadCustomers(session.token, {
          page: customersPage,
          search: customersSearchQuery,
          filters: customerFilters,
        });
      } catch (error) {
        await handleSessionError(error, 'Unable to create customer group.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to create customer group.'));
      }
    },
    [customerFilters, customersPage, customersSearchQuery, handleSessionError, loadCustomers, session],
  );

  const handleUpdateCustomerGroup = useCallback(
    async (groupId: string, input: MobileCustomerGroupInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await updateMobileCustomerGroup(session.token, groupId, input);
        await loadCustomers(session.token, {
          page: customersPage,
          search: customersSearchQuery,
          filters: customerFilters,
        });
      } catch (error) {
        await handleSessionError(error, 'Unable to update customer group.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to update customer group.'));
      }
    },
    [customerFilters, customersPage, customersSearchQuery, handleSessionError, loadCustomers, session],
  );

  const handleDeleteCustomerGroup = useCallback(
    async (groupId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await deleteMobileCustomerGroup(session.token, groupId);
        if (customerFilters.group === groupId) {
          setCustomerFilters((current) => ({ ...current, group: '' }));
          setCustomersPage(1);
        }
        await loadCustomers(session.token, {
          page: customersPage,
          search: customersSearchQuery,
          filters:
            customerFilters.group === groupId
              ? { ...customerFilters, group: '' }
              : customerFilters,
        });
      } catch (error) {
        await handleSessionError(error, 'Unable to delete customer group.', setCustomersError);
        throw new Error(getReadableError(error, 'Unable to delete customer group.'));
      }
    },
    [customerFilters, customersPage, customersSearchQuery, handleSessionError, loadCustomers, session],
  );

  const handleCreateServiceGroup = useCallback(
    async (input: MobileServiceGroupInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await createMobileServiceGroup(session.token, input);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to create service group.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to create service group.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleUpdateServiceGroup = useCallback(
    async (groupId: string, input: MobileServiceGroupInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await updateMobileServiceGroup(session.token, groupId, input);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to update service group.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to update service group.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleDeleteServiceGroup = useCallback(
    async (groupId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await deleteMobileServiceGroup(session.token, groupId);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to delete service group.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to delete service group.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleReorderServiceGroups = useCallback(
    async (ids: string[]) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await reorderMobileServiceGroups(session.token, ids);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to reorder service groups.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to reorder service groups.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleReorderServices = useCallback(
    async (ids: string[]) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await reorderMobileServices(session.token, ids);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to reorder services.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to reorder services.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleCreateService = useCallback(
    async (input: MobileServiceInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await createMobileService(session.token, input);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to create service.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to create service.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleUpdateService = useCallback(
    async (serviceId: string, input: MobileServiceInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await updateMobileService(session.token, serviceId, input);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to update service.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to update service.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleDeleteService = useCallback(
    async (serviceId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await deleteMobileService(session.token, serviceId);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to delete service.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to delete service.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleCreateStaff = useCallback(
    async (input: MobileStaffInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await createMobileStaff(session.token, input);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to create staff member.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to create staff member.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleUpdateStaff = useCallback(
    async (staffId: string, input: MobileStaffInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await updateMobileStaff(session.token, staffId, input);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to update staff member.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to update staff member.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleDeleteStaff = useCallback(
    async (staffId: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        await deleteMobileStaff(session.token, staffId);
        await loadServices(session.token, true);
      } catch (error) {
        await handleSessionError(error, 'Unable to delete staff member.', setServicesError);
        throw new Error(getReadableError(error, 'Unable to delete staff member.'));
      }
    },
    [handleSessionError, loadServices, session],
  );

  const handleLookupCheckIn = useCallback(
    async (phone: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        return await lookupMobileCheckIn(session.token, phone);
      } catch (error) {
        await handleSessionError(error, 'Unable to find customer.', setCheckInsError);
        throw new Error(getReadableError(error, 'Unable to find customer.'));
      }
    },
    [handleSessionError, session],
  );

  const handleCreateCheckIn = useCallback(
    async (input: MobileCheckInSubmissionInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        const response = await createMobileCheckIn(session.token, input);
        await Promise.all([
          loadCheckIns(session.token, checkInsDate),
          loadHome(session.token),
          customers
            ? loadCustomers(session.token, {
                page: customersPage,
                search: customersSearchQuery,
                filters: customerFilters,
              })
            : Promise.resolve(),
        ]);
        return response;
      } catch (error) {
        await handleSessionError(error, 'Unable to complete check-in.', setCheckInsError);
        throw new Error(getReadableError(error, 'Unable to complete check-in.'));
      }
    },
    [
      checkInsDate,
      customerFilters,
      customers,
      customersPage,
      customersSearchQuery,
      handleSessionError,
      loadCheckIns,
      loadCustomers,
      loadHome,
      session,
    ],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCustomersPage(1);
      setCustomersSearchQuery(customersSearchDraft.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [customersSearchDraft]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (home && !home.business.onboardingComplete && !businessProfile && !isLoadingBusinessProfile) {
      void loadBusinessProfile(session.token);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'settings' &&
      !businessProfile &&
      !isLoadingBusinessProfile
    ) {
      void loadBusinessProfile(session.token);
    }

    if (
      activeTab === 'appointments' &&
      (!appointments || appointments.selectedDate !== appointmentsDate) &&
      !isLoadingAppointments
    ) {
      void loadAppointments(session.token, appointmentsDate);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'services' &&
      !services &&
      !isLoadingServices
    ) {
      void loadServices(session.token);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'checkins' &&
      (!checkIns || checkIns.selectedDate !== checkInsDate) &&
      !isLoadingCheckIns
    ) {
      void loadCheckIns(session.token, checkInsDate);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'hours' &&
      !businessHours &&
      !isLoadingBusinessHours
    ) {
      void loadBusinessHours(session.token);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'aiReceptionist' &&
      !aiReceptionist &&
      !isLoadingAiReceptionist
    ) {
      void loadAiReceptionist(session.token);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'customerView' &&
      !customerView &&
      !isLoadingCustomerView
    ) {
      void loadCustomerView(session.token);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'reviews' &&
      !reviews &&
      !isLoadingReviews
    ) {
      void loadReviews(session.token);
    }

    if (
      activeTab === 'customers' &&
      (!customers ||
        customers.currentPage !== customersPage ||
        customers.search !== customersSearchQuery ||
        customers.filters.group !== customerFilters.group ||
        customers.filters.sms !== customerFilters.sms ||
        customers.filters.contact !== customerFilters.contact ||
        customers.filters.visit !== customerFilters.visit) &&
      !isLoadingCustomers
    ) {
      void loadCustomers(session.token, {
        page: customersPage,
        search: customersSearchQuery,
        filters: customerFilters,
      });
    }

    if (activeTab === 'deals' && !deals && !isLoadingDeals) {
      void loadDeals(session.token);
    }

    if (activeTab === 'more' && moreSection === 'referrals' && !referrals && !isLoadingReferrals) {
      void loadReferrals(session.token);
    }

    if (activeTab === 'more' && moreSection === 'payouts' && !funds && !isLoadingFunds) {
      void loadFunds(session.token);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'notifications' &&
      !notifications &&
      !isLoadingNotifications
    ) {
      void loadNotifications(session.token);
      void refreshPushPermissionStatus();
    }

    if (activeTab === 'more' && moreSection === 'billing' && !billing && !isLoadingBilling) {
      void loadBilling(session.token);
    }

    if (
      activeTab === 'more' &&
      moreSection === 'billing' &&
      home?.subscription.requiresPurchase &&
      !billingOffering &&
      !isLoadingBillingOffering
    ) {
      void loadBillingOffering(session.business.id);
    }
  }, [
    activeTab,
    aiReceptionist,
    appointments,
    appointmentsDate,
    billing,
    businessHours,
    businessProfile,
    checkIns,
    checkInsDate,
    customerFilters,
    customerView,
    customers,
    customersPage,
    customersSearchQuery,
    deals,
    funds,
    home,
    isLoadingAiReceptionist,
    isLoadingAppointments,
    isLoadingBilling,
    isLoadingBillingOffering,
    isLoadingBusinessHours,
    isLoadingBusinessProfile,
    isLoadingCheckIns,
    isLoadingCustomerView,
    isLoadingCustomers,
    isLoadingDeals,
    isLoadingFunds,
    isLoadingNotifications,
    isLoadingReferrals,
    isLoadingReviews,
    isLoadingServices,
    loadAiReceptionist,
    loadAppointments,
    loadBilling,
    loadBillingOffering,
    loadBusinessHours,
    loadBusinessProfile,
    loadCheckIns,
    loadCustomerView,
    loadCustomers,
    loadDeals,
    loadFunds,
    loadNotifications,
    loadReferrals,
    loadReviews,
    loadServices,
    moreSection,
    notifications,
    refreshPushPermissionStatus,
    referrals,
    reviews,
    session,
    services,
  ]);

  if (isBooting || (session && !home && isLoadingHome)) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.loadingTitle, { color: theme.text }]}>Opening your account</Text>
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            Checking your sign-in and loading the mobile workspace.
          </Text>
        </View>
      </View>
    );
  }

  if (session && !home) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.loadingTitle, { color: theme.text }]}>Couldn&apos;t open the app</Text>
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            {homeError ?? 'Please try loading the business app again.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadHome(session.token)}
            style={[styles.retryButton, { backgroundColor: theme.accent }]}
            testID="mobile-home-retry">
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={[styles.signOutButton, { borderColor: theme.border }]}
            testID="mobile-home-signout-fallback">
            <Text style={[styles.signOutButtonText, { color: theme.text }]}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!session || !home) {
    return (
      <MobileAuthScreen
        error={authError}
        isResendingCode={isResendingCode}
        isSubmitting={isSubmittingAuth}
        mode={authMode}
        notice={authNotice}
        onOpenPrivacyPolicy={() => handleOpenExternalUrl(APP_PRIVACY_URL)}
        onOpenTermsOfService={() => handleOpenExternalUrl(APP_TERMS_URL)}
        verificationEmail={pendingVerification?.email ?? ''}
        onBackToSignIn={() => {
          setAuthMode('sign-in');
          setAuthError(null);
          setAuthNotice(null);
        }}
        onLogin={handleLogin}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError(null);
          setAuthNotice(null);
        }}
        onRegister={handleRegister}
        onResendCode={handleResendCode}
        onVerify={handleVerifyCode}
      />
    );
  }

  if (!home.business.onboardingComplete) {
    if (isLoadingBusinessProfile || !businessProfile) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.loadingTitle, { color: theme.text }]}>Loading setup</Text>
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>
              Pulling in the business details you still need to finish.
            </Text>
            {businessProfileError ? (
              <>
                <Text style={[styles.loadingText, { color: theme.mutedText }]}>
                  {businessProfileError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadBusinessProfile(session.token)}
                  style={[styles.retryButton, { backgroundColor: theme.accent }]}
                  testID="mobile-onboarding-retry">
                  <Text style={styles.retryButtonText}>Try again</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <MobileOnboardingScreen
        error={businessProfileError}
        isSaving={isSavingBusinessProfile}
        profile={businessProfile}
        onSignOut={signOut}
        onSubmit={handleSaveBusinessProfile}
      />
    );
  }

  return (
    <MobileAppShell
      activeTab={activeTab}
      aiReceptionist={aiReceptionist}
      aiReceptionistError={aiReceptionistError}
      appointmentComposerCustomers={appointmentComposerCustomers}
      appointmentComposerError={appointmentComposerError}
      appointments={appointments}
      appointmentsError={appointmentsError}
      appStoreOffering={billingOffering}
      billing={billing}
      billingNotice={billingNotice}
      billingPurchaseError={billingPurchaseError}
      billingError={billingError}
      business={home.business}
      businessHours={businessHours}
      businessHoursError={businessHoursError}
      businessProfile={businessProfile}
      businessProfileError={businessProfileError}
      checkIns={checkIns}
      checkInsError={checkInsError}
      customerView={customerView}
      customerViewError={customerViewError}
      customers={customers}
      customersError={customersError}
      customerFilters={customerFilters}
      customersSearchDraft={customersSearchDraft}
      deals={deals}
      dealsError={dealsError}
      funds={funds}
      fundsError={fundsError}
      home={home}
      homeError={homeError}
      isAiReceptionistLoading={isLoadingAiReceptionist}
      isAiReceptionistRefreshing={isRefreshingAiReceptionist}
      isAiReceptionistSaving={isSavingAiReceptionist}
      isAppointmentComposerLoading={isLoadingAppointmentComposer}
      isAppointmentsLoading={isLoadingAppointments}
      isAppointmentsRefreshing={isRefreshingAppointments}
      isBillingLoading={isLoadingBilling}
      isBillingOfferingLoading={isLoadingBillingOffering}
      isBillingRefreshing={isRefreshingBilling}
      isManagingSubscription={isManagingSubscription}
      isBusinessHoursLoading={isLoadingBusinessHours}
      isBusinessHoursRefreshing={isRefreshingBusinessHours}
      isBusinessHoursSaving={isSavingBusinessHours}
      isBusinessProfileLoading={isLoadingBusinessProfile}
      isDeletingAccount={isDeletingAccount}
      isCheckInsLoading={isLoadingCheckIns}
      isCheckInsRefreshing={isRefreshingCheckIns}
      isCustomerViewLoading={isLoadingCustomerView}
      isCustomerViewRefreshing={isRefreshingCustomerView}
      isCustomersLoading={isLoadingCustomers}
      isCustomersRefreshing={isRefreshingCustomers}
      isDealsLoading={isLoadingDeals}
      isDealsRefreshing={isRefreshingDeals}
      isFundsLoading={isLoadingFunds}
      isFundsRefreshing={isRefreshingFunds}
      isHomeRefreshing={isRefreshingHome}
      isNotificationsLoading={isLoadingNotifications}
      isNotificationsMarkingRead={isMarkingNotificationsRead}
      isNotificationsRefreshing={isRefreshingNotifications}
      isPurchasingSubscription={isPurchasingSubscription}
      isReferralsLoading={isLoadingReferrals}
      isReferralsRefreshing={isRefreshingReferrals}
      isRestoringSubscription={isRestoringSubscription}
      isReviewsLoading={isLoadingReviews}
      isReviewsRefreshing={isRefreshingReviews}
      isSavingBusinessProfile={isSavingBusinessProfile}
      isServicesLoading={isLoadingServices}
      isServicesRefreshing={isRefreshingServices}
      onChangeCustomerFilters={changeCustomerFilters}
      moreSection={moreSection}
      notifications={notifications}
      notificationsError={notificationsError}
      notificationsPermissionStatus={pushPermissionStatus}
      onChangeCustomersSearchDraft={setCustomersSearchDraft}
      onChangeMoreSection={handleChangeMoreSection}
      onChangeTab={handleChangeTab}
      onCreateAppointment={handleCreateAppointment}
      onCreateAppointmentCustomer={handleCreateAppointmentCustomer}
      onCreateCustomer={handleCreateCustomer}
      onCreateCustomerGroup={handleCreateCustomerGroup}
      onCreateCheckIn={handleCreateCheckIn}
      onCreateServiceGroup={handleCreateServiceGroup}
      onCreateService={handleCreateService}
      onCreateStaff={handleCreateStaff}
      onDeleteAccount={handleDeleteAccount}
      onDeleteCustomer={handleDeleteCustomer}
      onDeleteCustomerGroup={handleDeleteCustomerGroup}
      onDeleteAppointment={handleDeleteAppointment}
      onDeleteServiceGroup={handleDeleteServiceGroup}
      onDeleteService={handleDeleteService}
      onDeleteStaff={handleDeleteStaff}
      onFetchCustomerDetail={handleFetchCustomerDetail}
      onFetchCustomerMessages={handleFetchCustomerMessages}
      onGoToCustomersPage={goToCustomersPage}
      onJumpCheckInsToToday={jumpCheckInsToToday}
      onJumpAppointmentsToToday={jumpAppointmentsToToday}
      onSelectAppointmentsDate={selectAppointmentsDate}
      onSelectCheckInsDate={selectCheckInsDate}
      onLookupCheckIn={handleLookupCheckIn}
      onLookupRedeemCode={handleLookupRedeemCode}
      onLoadAppointmentComposerResources={async () => {
        if (!session) {
          throw new Error('Sign in again to continue.');
        }
        await loadAppointmentComposerResources(session.token);
      }}
      onManageSubscription={handleOpenCustomerCenter}
      onNextCheckInsDate={goToNextCheckInsDate}
      onNextAppointmentsDate={goToNextAppointmentsDate}
      onNextCustomersPage={goToNextCustomersPage}
      onOpenExternalUrl={handleOpenExternalUrl}
      onOpenAppointments={openAppointmentsTab}
      onOpenCustomers={openCustomersTab}
      onOpenDeals={openDealsTab}
      onOpenFunds={openFundsTab}
      onOpenReferrals={openReferralsTab}
      onEnablePushNotifications={handleEnablePushNotifications}
      onOpenNotification={handleOpenNotification}
      onPreviousCheckInsDate={goToPreviousCheckInsDate}
      onPreviousAppointmentsDate={goToPreviousAppointmentsDate}
      onPreviousCustomersPage={goToPreviousCustomersPage}
      onPurchasePackage={handlePurchaseSubscription}
      onRedeemCode={handleRedeemCode}
      onRefreshAiReceptionist={handleRefreshAiReceptionist}
      onRefreshBilling={handleRefreshBilling}
      onRefreshBusinessHours={handleRefreshBusinessHours}
      onRefreshBusinessProfile={handleRefreshBusinessProfile}
      onRefreshCheckIns={handleRefreshCheckIns}
      onRefreshAppointments={handleRefreshAppointments}
      onRefreshCustomerView={handleRefreshCustomerView}
      onRefreshCustomers={handleRefreshCustomers}
      onRefreshDeals={handleRefreshDeals}
      onRefreshFunds={handleRefreshFunds}
      onRefreshHome={handleRefreshHome}
      onRefreshNotifications={handleRefreshNotifications}
      onMarkNotificationsRead={handleMarkNotificationsRead}
      onRefreshReferrals={handleRefreshReferrals}
      onRefreshReviews={handleRefreshReviews}
      onRefreshServices={handleRefreshServices}
      onRestorePurchases={handleRestoreSubscription}
      onSaveAiReceptionist={handleSaveAiReceptionist}
      onSaveBusinessHours={handleSaveBusinessHours}
      onSaveBusinessProfile={handleSaveBusinessProfile}
      onSendReviewRequest={handleSendCustomerReviewRequest}
      onSendCustomerMessage={handleSendCustomerMessage}
      onShareCustomerViewLink={shareCustomerViewLink}
      onShareDeal={shareDeal}
      onShareReferral={shareReferral}
      onShareReviewSurvey={shareReviewSurvey}
      onSignOut={signOut}
      onReorderServiceGroups={handleReorderServiceGroups}
      onReorderServices={handleReorderServices}
      onUpdateAppointment={handleUpdateAppointment}
      onUpdateCustomer={handleUpdateCustomer}
      onUpdateCustomerGroup={handleUpdateCustomerGroup}
      onUpdateServiceGroup={handleUpdateServiceGroup}
      onUpdateService={handleUpdateService}
      onUpdateStaff={handleUpdateStaff}
      referrals={referrals}
      referralsError={referralsError}
      reviews={reviews}
      reviewsError={reviewsError}
      services={services}
      servicesError={servicesError}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  loadingTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    width: '100%',
  },
  retryButtonText: {
    color: '#f8fffc',
    fontSize: 15,
    fontWeight: '800',
  },
  signOutButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    width: '100%',
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
