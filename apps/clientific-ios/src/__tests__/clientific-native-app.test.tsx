import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
    MobileOnboardingInput: {},
    MobileRedeemResult: {},
    MobileReferralsSummary: {},
    MobileReviewsSummary: {},
    MobileServiceGroupInput: {},
    MobileServiceInput: {},
    MobileServicesSummary: {},
    MobileStaffInput: {},
    loginWithClientific: mockClientificApi.loginWithClientific,
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
  registerForPushNotificationsAsync: jest.fn(async () => null),
}));

jest.mock('@/lib/mobile-subscriptions', () => ({
  buildMobileRevenueCatAppUserId: jest.fn((businessId: string) => `business:${businessId}`),
  clearRevenueCatUser: jest.fn(async () => undefined),
  configureRevenueCatForBusiness: jest.fn(async () => undefined),
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
        <Pressable testID="mock-switch-register" onPress={() => onModeChange('sign-up')}>
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
      onOpenCustomers,
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
        <Pressable testID="mock-shell-open-customers" onPress={onOpenCustomers}>
          <Text>customers</Text>
        </Pressable>
      </View>
    ),
  };
});

import { ClientificNativeApp } from '@/components/clientific-native-app';

const { __mockClientificApi: mockClientificApi } = jest.requireMock('@/lib/clientific-api') as {
  __mockClientificApi: Record<string, jest.Mock>;
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

beforeEach(() => {
  secureStoreMock.__reset();
  Object.values(mockClientificApi).forEach((mockFn) => mockFn.mockReset());
  mockClientificApi.fetchMobileHomeSummary.mockResolvedValue(activeHome);
  mockClientificApi.loginWithClientific.mockResolvedValue({
    token: 'mobile-token',
    business: activeHome.business,
  });
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
});
