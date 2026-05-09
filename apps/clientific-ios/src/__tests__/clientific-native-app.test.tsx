import React from 'react';
import * as Device from 'expo-device';
import * as ExpoLinking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

type MockExpoLinkingListener = (payload: { url: string }) => void;

jest.mock('@/lib/clientific-api', () => {
  const mockClientificApi = {
    loginWithClientific: jest.fn(),
    registerWithClientific: jest.fn(),
    confirmVerificationCode: jest.fn(),
    resendVerificationCode: jest.fn(),
    fetchMobileHomeSummary: jest.fn(),
    fetchMobileCustomers: jest.fn(),
    fetchMobileBilling: jest.fn(),
    fetchMobileAppointments: jest.fn(),
    fetchMobileBusinessProfile: jest.fn(),
    fetchMobileAiReceptionist: jest.fn(),
    fetchMobileCheckIns: jest.fn(),
    fetchMobileCustomerView: jest.fn(),
    fetchMobileDeals: jest.fn(),
    fetchMobileReferrals: jest.fn(),
    fetchMobileFunds: jest.fn(),
    fetchMobileNotifications: jest.fn(),
    fetchMobileServices: jest.fn(),
    fetchMobileBusinessHours: jest.fn(),
    fetchMobileReviews: jest.fn(),
    fetchMobileCustomerDetail: jest.fn(),
    fetchMobileCustomerSmsLogs: jest.fn(),
    lookupMobileCheckIn: jest.fn(),
    lookupMobileRedemption: jest.fn(),
    redeemMobileCode: jest.fn(),
    updateMobileAiReceptionist: jest.fn(),
    updateMobileAppointment: jest.fn(),
    updateMobileBusinessHours: jest.fn(),
    updateMobileBusinessProfile: jest.fn(),
    updateMobileCustomer: jest.fn(),
    updateMobileCustomerGroup: jest.fn(),
    updateMobileServiceGroup: jest.fn(),
    updateMobileService: jest.fn(),
    updateMobileStaff: jest.fn(),
    reorderMobileServiceGroups: jest.fn(),
    reorderMobileServices: jest.fn(),
    createMobileService: jest.fn(),
    createMobileServiceGroup: jest.fn(),
    createMobileStaff: jest.fn(),
    createMobileCustomer: jest.fn(),
    createMobileCustomerGroup: jest.fn(),
    createMobileCheckIn: jest.fn(),
    createMobileAppointment: jest.fn(),
    deleteMobileBusinessAccount: jest.fn(),
    deleteMobileService: jest.fn(),
    deleteMobileServiceGroup: jest.fn(),
    deleteMobileStaff: jest.fn(),
    deleteMobileAppointment: jest.fn(),
    deleteMobileCustomer: jest.fn(),
    deleteMobileCustomerGroup: jest.fn(),
    markMobileNotificationsRead: jest.fn(),
    sendMobileReviewRequest: jest.fn(),
    sendMobileCustomerMessage: jest.fn(),
    registerMobilePushToken: jest.fn(),
    unregisterMobilePushToken: jest.fn(),
    syncMobileAppStoreSubscription: jest.fn(),
  };

  class ClientificApiError extends Error {
    public readonly status: number;
    public readonly code: string | null;

    constructor(
      message: string,
      statusValue: number,
      codeValue: string | null = null,
    ) {
      super(message);
      this.name = 'ClientificApiError';
      this.status = statusValue;
      this.code = codeValue;
    }
  }

  return {
    createMobileService: mockClientificApi.createMobileService,
    createMobileServiceGroup: mockClientificApi.createMobileServiceGroup,
    createMobileStaff: mockClientificApi.createMobileStaff,
    createMobileCustomer: mockClientificApi.createMobileCustomer,
    createMobileCustomerGroup: mockClientificApi.createMobileCustomerGroup,
    createMobileCheckIn: mockClientificApi.createMobileCheckIn,
    createMobileAppointment: mockClientificApi.createMobileAppointment,
    ClientificApiError,
    deleteMobileBusinessAccount: mockClientificApi.deleteMobileBusinessAccount,
    deleteMobileService: mockClientificApi.deleteMobileService,
    deleteMobileServiceGroup: mockClientificApi.deleteMobileServiceGroup,
    deleteMobileStaff: mockClientificApi.deleteMobileStaff,
    deleteMobileAppointment: mockClientificApi.deleteMobileAppointment,
    confirmVerificationCode: mockClientificApi.confirmVerificationCode,
    deleteMobileCustomer: mockClientificApi.deleteMobileCustomer,
    deleteMobileCustomerGroup: mockClientificApi.deleteMobileCustomerGroup,
    fetchMobileAiReceptionist: mockClientificApi.fetchMobileAiReceptionist,
    fetchMobileAppointments: mockClientificApi.fetchMobileAppointments,
    fetchMobileBilling: mockClientificApi.fetchMobileBilling,
    fetchMobileBusinessHours: mockClientificApi.fetchMobileBusinessHours,
    fetchMobileBusinessProfile: mockClientificApi.fetchMobileBusinessProfile,
    fetchMobileCheckIns: mockClientificApi.fetchMobileCheckIns,
    fetchMobileCustomerDetail: mockClientificApi.fetchMobileCustomerDetail,
    fetchMobileCustomerSmsLogs: mockClientificApi.fetchMobileCustomerSmsLogs,
    fetchMobileCustomerView: mockClientificApi.fetchMobileCustomerView,
    fetchMobileCustomers: mockClientificApi.fetchMobileCustomers,
    fetchMobileDeals: mockClientificApi.fetchMobileDeals,
    fetchMobileFunds: mockClientificApi.fetchMobileFunds,
    fetchMobileHomeSummary: mockClientificApi.fetchMobileHomeSummary,
    fetchMobileNotifications: mockClientificApi.fetchMobileNotifications,
    fetchMobileReferrals: mockClientificApi.fetchMobileReferrals,
    fetchMobileReviews: mockClientificApi.fetchMobileReviews,
    fetchMobileServices: mockClientificApi.fetchMobileServices,
    getClientificWebUrl: jest.fn(() => 'https://www.clientific.app'),
    lookupMobileCheckIn: mockClientificApi.lookupMobileCheckIn,
    lookupMobileRedemption: mockClientificApi.lookupMobileRedemption,
    MobileAiReceptionistSummary: {},
    MobileAiReceptionistUpdateInput: {},
    MobileAppointmentInput: {},
    MobileAppointmentUpdateInput: {},
    MobileAppointmentsSummary: {},
    MobileBillingSummary: {},
    MobileBusinessHoursSummary: {},
    MobileBusinessProfile: {},
    MobileCustomerFilters: {},
    MobileCustomerGroupInput: {},
    MobileCustomerInput: {},
    MobileCustomerRecord: {},
    MobileCheckInSubmissionInput: {},
    MobileCheckInsSummary: {},
    MobileCustomerViewSummary: {},
    MobileCustomersSummary: {},
    MobileDealRecord: {},
    MobileDealsSummary: {},
    MobileFundsSummary: {},
    MobileHomeSummary: {},
    MobileLoginResponse: {},
    MobileNotificationsSummary: {},
    MobileOnboardingInput: {},
    MobileRedeemResult: {},
    MobileReferralsSummary: {},
    MobileReviewsSummary: {},
    MobileServiceGroupInput: {},
    MobileServiceInput: {},
    MobileServicesSummary: {},
    MobileStaffInput: {},
    loginWithClientific: mockClientificApi.loginWithClientific,
    markMobileNotificationsRead: mockClientificApi.markMobileNotificationsRead,
    redeemMobileCode: mockClientificApi.redeemMobileCode,
    registerMobilePushToken: mockClientificApi.registerMobilePushToken,
    registerWithClientific: mockClientificApi.registerWithClientific,
    resendVerificationCode: mockClientificApi.resendVerificationCode,
    sendMobileReviewRequest: mockClientificApi.sendMobileReviewRequest,
    sendMobileCustomerMessage: mockClientificApi.sendMobileCustomerMessage,
    syncMobileAppStoreSubscription: mockClientificApi.syncMobileAppStoreSubscription,
    unregisterMobilePushToken: mockClientificApi.unregisterMobilePushToken,
    updateMobileAiReceptionist: mockClientificApi.updateMobileAiReceptionist,
    updateMobileAppointment: mockClientificApi.updateMobileAppointment,
    updateMobileBusinessHours: mockClientificApi.updateMobileBusinessHours,
    updateMobileBusinessProfile: mockClientificApi.updateMobileBusinessProfile,
    updateMobileCustomer: mockClientificApi.updateMobileCustomer,
    updateMobileCustomerGroup: mockClientificApi.updateMobileCustomerGroup,
    updateMobileServiceGroup: mockClientificApi.updateMobileServiceGroup,
    updateMobileService: mockClientificApi.updateMobileService,
    updateMobileStaff: mockClientificApi.updateMobileStaff,
    reorderMobileServiceGroups: mockClientificApi.reorderMobileServiceGroups,
    reorderMobileServices: mockClientificApi.reorderMobileServices,
    __mockClientificApi: mockClientificApi,
  };
});

jest.mock('@/lib/mobile-push-notifications', () => ({
  addPushNotificationResponseListener: jest.fn(() => ({ remove: jest.fn() })),
  getMobilePushPermissionStatus: jest.fn(async () => 'granted'),
  registerForPushNotificationsAsync: jest.fn(async () => null),
}));

jest.mock('@/lib/mobile-subscriptions', () => ({
  buildMobileRevenueCatAppUserId: jest.fn((businessId: string) => `business:${businessId}`),
  clearRevenueCatUser: jest.fn(async () => undefined),
  configureRevenueCatForBusiness: jest.fn(async () => undefined),
  getSafeAppStoreBillingErrorMessage: jest.fn(
    (error: unknown, fallback = 'App Store billing is temporarily unavailable right now. Please try again shortly.') => {
      if (error instanceof Error && /configuration|revenuecat|app store connect|offerings-empty|rev\.cat/i.test(error.message)) {
        return 'App Store plans are not available yet for this account. Pull to refresh or try again shortly.';
      }
      return fallback;
    },
  ),
  getCurrentRevenueCatOffering: jest.fn(async () => null),
  isRevenueCatPurchaseCancelled: jest.fn(() => false),
  presentRevenueCatCustomerCenter: jest.fn(async () => undefined),
  purchaseRevenueCatPackage: jest.fn(async () => undefined),
  restoreRevenueCatPurchases: jest.fn(async () => undefined),
}));

jest.mock('@/lib/referral-links', () => ({
  buildReferralInviteUrl: jest.fn((code: string) => `https://www.clientific.app/register?ref=${code}`),
  resolveReferralCodeInput: jest.fn((value: string) => ({
    referralCode: value.trim() || null,
    error: null,
  })),
}));

jest.mock('expo-linking', () => {
  const listeners = new Set<MockExpoLinkingListener>();

  const api = {
    getInitialURL: jest.fn(async () => null),
    addEventListener: jest.fn((_event: string, listener: MockExpoLinkingListener) => {
      listeners.add(listener);
      return {
        remove: () => listeners.delete(listener),
      };
    }),
    __emitUrl: (url: string) => {
      listeners.forEach((listener) => listener({ url }));
    },
    __reset: () => {
      listeners.clear();
      api.getInitialURL.mockReset();
      api.getInitialURL.mockResolvedValue(null);
      api.addEventListener.mockClear();
    },
  };

  return api;
});

jest.mock('@/components/mobile-auth-screen', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    MobileAuthScreen: ({
      mode,
      notice,
      error,
      onModeChange,
      onLogin,
      onRegister,
      onVerify,
    }: any) => (
      <View>
        <Text testID="mock-auth-mode">{mode}</Text>
        {notice ? <Text>{notice}</Text> : null}
        {error ? <Text>{error}</Text> : null}
        <Pressable testID="mock-switch-register" onPress={() => onModeChange('register')}>
          <Text>switch register</Text>
        </Pressable>
        <Pressable
          testID="mock-login"
          onPress={() => onLogin('owner@clientific.app', 'Password123!')}>
          <Text>login</Text>
        </Pressable>
        <Pressable
          testID="mock-register"
          onPress={() =>
            onRegister({
              businessName: 'Clientific Studio',
              businessType: 'Salon',
              email: 'owner@clientific.app',
              password: 'Password123!',
              confirmPassword: 'Password123!',
              acceptTerms: true,
              referralCode: '',
            })
          }>
          <Text>register</Text>
        </Pressable>
        <Pressable
          testID="mock-verify"
          onPress={() => onVerify('owner@clientific.app', '123456')}>
          <Text>verify</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock('@/components/mobile-onboarding-screen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    MobileOnboardingScreen: () => (
      <View>
        <Text>Mock onboarding</Text>
      </View>
    ),
  };
});

jest.mock('@/components/mobile-app-shell', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    MobileAppShell: ({
      activeTab,
      moreSection,
      billingNotice,
      billingPurchaseError,
      home,
      onChangeMoreSection,
      onChangeTab,
      notificationsError,
      onEnablePushNotifications,
      onOpenCustomers,
      onRefreshBilling,
    }: any) => (
      <View>
        <Text testID="mock-shell-tab">{activeTab}</Text>
        <Text testID="mock-shell-more-section">{moreSection}</Text>
        <Text testID="mock-shell-requires-purchase">
          {String(home.subscription.requiresPurchase)}
        </Text>
        {billingNotice ? <Text testID="mock-shell-billing-notice">{billingNotice}</Text> : null}
        {billingPurchaseError ? (
          <Text testID="mock-shell-billing-error">{billingPurchaseError}</Text>
        ) : null}
        {notificationsError ? (
          <Text testID="mock-shell-notifications-error">{notificationsError}</Text>
        ) : null}
        <Pressable testID="mock-shell-open-customers" onPress={onOpenCustomers}>
          <Text>customers</Text>
        </Pressable>
        <Pressable
          testID="mock-shell-enable-push"
          onPress={onEnablePushNotifications}>
          <Text>enable push</Text>
        </Pressable>
        <Pressable
          testID="mock-shell-open-billing"
          onPress={() => {
            onChangeMoreSection('billing');
            onChangeTab('more');
          }}>
          <Text>billing</Text>
        </Pressable>
        <Pressable testID="mock-shell-refresh-billing" onPress={onRefreshBilling}>
          <Text>refresh billing</Text>
        </Pressable>
      </View>
    ),
  };
});

import { ClientificNativeApp } from '@/components/clientific-native-app';

const { __mockClientificApi: mockClientificApi } = jest.requireMock('@/lib/clientific-api') as {
  __mockClientificApi: Record<string, jest.Mock>;
};

const mockMobileSubscriptions = jest.requireMock('@/lib/mobile-subscriptions') as {
  getSafeAppStoreBillingErrorMessage: jest.Mock;
  getCurrentRevenueCatOffering: jest.Mock;
};

const mockExpoLinking = ExpoLinking as typeof ExpoLinking & {
  __emitUrl: (url: string) => void;
  __reset: () => void;
  getInitialURL: jest.Mock;
  addEventListener: jest.Mock;
};

const secureStoreMock = SecureStore as typeof SecureStore & {
  __reset: () => void;
  __setItem: (key: string, value: string) => void;
};

const activeHome = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  subscription: {
    plan: 'starter',
    status: 'active',
    billingProvider: 'stripe' as const,
    isActive: true,
    requiresPurchase: false,
  },
  metrics: [],
  todayAppointments: [],
  referralSnapshot: {
    activeCount: 0,
    pendingCount: 0,
    lifetimeCredits: 0,
    payoutReady: true,
    setupMessage: null,
  },
  trialDaysRemaining: null,
};

const lockedHome = {
  ...activeHome,
  subscription: {
    plan: 'trial',
    status: 'inactive',
    billingProvider: 'none' as const,
    isActive: false,
    requiresPurchase: true,
  },
};

const appStoreBillingSummary = {
  business: activeHome.business,
  currentPlanName: 'Trial',
  currentPlanPriceLabel: '$0',
  planSummary: 'Start the 14-day App Store trial to unlock the full Clientific workspace.',
  billingProvider: 'none' as const,
  billingProviderLabel: 'App Store',
  managementTitle: 'App Store billing',
  managementSummary: 'Manage or cancel subscriptions in your App Store account settings.',
  subscriptionStatus: 'inactive',
  subscriptionStatusLabel: 'Inactive',
  isActive: false,
  canPurchaseInApp: true,
  showManageInApp: false,
  trialDaysRemaining: null,
  trialEndsAtLabel: null,
  nextBillingDateLabel: null,
  paymentMethodSummary: 'Apple will manage billing after purchase.',
  invoiceEmptyState: 'No invoices yet.',
  paymentMethod: null,
  invoices: [],
};

const notificationsSummary = {
  business: activeHome.business,
  unreadCount: 1,
  notifications: [
    {
      id: 'notif-1',
      type: 'new_appointment',
      title: 'New appointment booked',
      message: 'Jordan booked a haircut for 11:30 AM.',
      link: '/dashboard/appointments',
      read: false,
      createdAt: '2026-03-30T18:45:00.000Z',
      createdAtLabel: 'Mar 30, 2:45 PM',
    },
  ],
};

beforeEach(() => {
  secureStoreMock.__reset();
  mockExpoLinking.__reset();
  (Device as typeof Device & { __setIsDevice: (value: boolean) => void }).__setIsDevice(true);
  Object.values(mockClientificApi).forEach((mockFn) => mockFn.mockReset());
  mockClientificApi.fetchMobileHomeSummary.mockResolvedValue(activeHome);
  mockClientificApi.loginWithClientific.mockResolvedValue({
    token: 'mobile-token',
    business: activeHome.business,
  });
  mockClientificApi.fetchMobileBilling.mockResolvedValue(appStoreBillingSummary);
  mockClientificApi.fetchMobileNotifications.mockResolvedValue(notificationsSummary);
  mockClientificApi.markMobileNotificationsRead.mockResolvedValue({ success: true, unreadCount: 0 });
  mockClientificApi.registerWithClientific.mockResolvedValue({
    success: true,
    verificationEmailSent: true,
  });
  mockClientificApi.confirmVerificationCode.mockResolvedValue({ success: true });
});

describe('ClientificNativeApp', () => {
  it('routes brand-new iPhone signups into billing when the account still needs a purchase', async () => {
    mockClientificApi.fetchMobileHomeSummary.mockResolvedValue(lockedHome);

    render(<ClientificNativeApp />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-switch-register')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mock-switch-register'));
    fireEvent.press(screen.getByTestId('mock-register'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-auth-mode').props.children).toBe('verify');
    });

    fireEvent.press(screen.getByTestId('mock-verify'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('more');
      expect(screen.getByTestId('mock-shell-more-section').props.children).toBe('billing');
    });

    expect(screen.getByTestId('mock-shell-requires-purchase').props.children).toBe('true');
    expect(screen.getByTestId('mock-shell-billing-notice').props.children).toMatch(
      /Start the 14-day App Store trial/i,
    );
  });

  it('redirects SUBSCRIPTION_REQUIRED customer loads into the billing paywall instead of leaving a generic error', async () => {
    secureStoreMock.__setItem('clientific.mobile.session.token', 'existing-token');
    const { ClientificApiError } = jest.requireMock('@/lib/clientific-api');
    mockClientificApi.fetchMobileHomeSummary.mockResolvedValue(activeHome);
    mockClientificApi.fetchMobileCustomers.mockRejectedValue(
      new ClientificApiError('Active subscription required', 403, 'SUBSCRIPTION_REQUIRED'),
    );

    render(<ClientificNativeApp />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('dashboard');
    });

    fireEvent.press(screen.getByTestId('mock-shell-open-customers'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('more');
      expect(screen.getByTestId('mock-shell-more-section').props.children).toBe('billing');
    });

    expect(screen.getByTestId('mock-shell-billing-notice').props.children).toMatch(
      /Start the 14-day App Store trial from Billing/i,
    );
    expect(screen.queryByTestId('mock-shell-billing-error')).toBeNull();
  });

  it('loads App Store offerings once on entry and only retries on an explicit billing refresh', async () => {
    secureStoreMock.__setItem('clientific.mobile.session.token', 'existing-token');
    mockClientificApi.fetchMobileHomeSummary.mockResolvedValue(lockedHome);
    mockMobileSubscriptions.getCurrentRevenueCatOffering.mockResolvedValue(null);

    render(<ClientificNativeApp />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('dashboard');
    });

    fireEvent.press(screen.getByTestId('mock-shell-open-billing'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('more');
      expect(screen.getByTestId('mock-shell-more-section').props.children).toBe('billing');
    });

    await waitFor(() => {
      expect(mockMobileSubscriptions.getCurrentRevenueCatOffering).toHaveBeenCalled();
    });

    const baselineCallCount = mockMobileSubscriptions.getCurrentRevenueCatOffering.mock.calls.length;

    await waitFor(async () => {
      await Promise.resolve();
      expect(mockMobileSubscriptions.getCurrentRevenueCatOffering).toHaveBeenCalledTimes(
        baselineCallCount,
      );
    });

    fireEvent.press(screen.getByTestId('mock-shell-refresh-billing'));

    await waitFor(() => {
      expect(mockMobileSubscriptions.getCurrentRevenueCatOffering).toHaveBeenCalledTimes(
        baselineCallCount + 1,
      );
    });
  });

  it('never surfaces raw RevenueCat configuration troubleshooting text in billing', async () => {
    secureStoreMock.__setItem('clientific.mobile.session.token', 'existing-token');
    mockClientificApi.fetchMobileHomeSummary.mockResolvedValue(lockedHome);
    mockMobileSubscriptions.getCurrentRevenueCatOffering.mockRejectedValue(
      new Error(
        "There's a problem with your configuration. None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect. More information: https://rev.cat/why-are-offerings-empty",
      ),
    );

    render(<ClientificNativeApp />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('dashboard');
    });

    fireEvent.press(screen.getByTestId('mock-shell-open-billing'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-more-section').props.children).toBe('billing');
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-billing-error').props.children).toBe(
        'App Store plans are not available yet for this account. Pull to refresh or try again shortly.',
      );
    });

    expect(screen.queryByText(/RevenueCat dashboard/i)).toBeNull();
    expect(screen.queryByText(/rev\.cat/i)).toBeNull();
  });

  it('opens billing when the app receives a billing deep link', async () => {
    secureStoreMock.__setItem('clientific.mobile.session.token', 'existing-token');
    mockClientificApi.fetchMobileHomeSummary.mockResolvedValue(lockedHome);

    render(<ClientificNativeApp />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('dashboard');
    });

    act(() => {
      mockExpoLinking.__emitUrl('clientific://app?tab=more&section=billing');
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('more');
      expect(screen.getByTestId('mock-shell-more-section').props.children).toBe('billing');
    });
  });

  it('explains that simulator builds cannot finish push setup', async () => {
    secureStoreMock.__setItem('clientific.mobile.session.token', 'existing-token');
    (Device as typeof Device & { __setIsDevice: (value: boolean) => void }).__setIsDevice(false);

    render(<ClientificNativeApp />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-tab').props.children).toBe('dashboard');
    });

    fireEvent.press(screen.getByTestId('mock-shell-enable-push'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-shell-notifications-error').props.children).toBe(
        'Push notifications need a physical iPhone or iPad. The iOS simulator can open the setup flow, but it cannot receive permission prompts or live push alerts.',
      );
    });
  });
});
