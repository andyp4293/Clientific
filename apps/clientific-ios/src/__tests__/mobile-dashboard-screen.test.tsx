import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MobileAppShell } from '@/components/mobile-app-shell';
import type { MobileCustomerFilters, MobileCustomersSummary } from '@/lib/clientific-api';

const business = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  onboardingComplete: true,
};

const businessProfile = {
  ...business,
  ownerPhone: '+15551234567',
  phone: '+15557654321',
  businessEmail: 'hello@clientific.app',
  street: '123 Main St',
  city: 'New York',
  state: 'NY',
  zipCode: '10001',
  country: 'United States',
  timezone: 'America/New_York',
};

const home = {
  business,
  subscription: {
    plan: 'starter',
    status: 'active',
    billingProvider: 'stripe' as const,
    isActive: true,
    requiresPurchase: false,
  },
  metrics: [
    { label: 'Booked today', value: '3', helper: 'Appointments' },
    { label: 'Checked in', value: '1', helper: 'Guests today' },
  ],
  todayAppointments: [
    {
      id: 'appt-1',
      customerName: 'Jordan Lee',
      serviceName: 'Haircut',
      status: 'confirmed',
      startTimeLabel: '11:30 AM',
    },
  ],
  referralSnapshot: {
    activeCount: 2,
    pendingCount: 1,
    lifetimeCredits: 87,
    payoutReady: true,
    setupMessage: null,
  },
  trialDaysRemaining: null,
};

const appointments = {
  business,
  selectedDate: '2026-03-30',
  dateLabel: 'Monday, March 30',
  timezone: 'America/New_York',
  counts: {
    total: 3,
    pending: 1,
    confirmed: 1,
    scheduled: 1,
  },
  appointments: [
    {
      id: 'appt-1',
      customerId: 'cust-1',
      customerName: 'Jordan Lee',
      serviceId: 'svc-1',
      serviceName: 'Haircut',
      staffId: 'staff-1',
      staffName: 'Taylor',
      status: 'confirmed',
      statusLabel: 'Confirmed',
      startTime: '2026-03-30T15:30:00.000Z',
      startTimeLabel: '11:30 AM',
      endTimeLabel: '12:15 PM',
      duration: 45,
      source: 'dashboard',
      sourceLabel: 'Manual',
      notes: null,
      canConfirm: false,
      canModify: true,
    },
  ],
};

const checkIns = {
  business,
  selectedDate: '2026-03-30',
  dateLabel: 'Monday, March 30',
  timezone: 'America/New_York',
  count: 1,
  latestCheckInLabel: '1:45 PM',
  checkIns: [
    {
      id: 'check-1',
      customerId: 'cust-1',
      customerName: 'Jordan Lee',
      phoneDisplay: '+15551234567',
      serviceName: 'Haircut',
      staffName: 'Taylor',
      amountSpentLabel: '$45.00',
      checkedInAtLabel: '1:45 PM',
      lastVisitLabel: 'Mar 29, 2026',
    },
  ],
};

const customerFilters: MobileCustomerFilters = {
  group: '',
  sms: '',
  contact: '',
  visit: '',
};

const customers: MobileCustomersSummary = {
  business,
  search: '',
  filters: customerFilters,
  currentPage: 1,
  totalPages: 2,
  totalCustomers: 21,
  pageSize: 20,
  groups: [
    {
      id: 'group-1',
      name: 'VIP',
      promotionSmsEnabled: true,
      membersCount: 4,
    },
  ],
  customers: [
    {
      id: 'cust-1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '+15551234567',
      phoneDisplay: '+15551234567',
      joinedLabel: 'Mar 18, 2026',
      lastVisitLabel: 'Mar 29, 2026',
      totalSpentLabel: '$120.00',
      segment: 'VIP',
      segmentLabel: 'VIP',
      smsConsent: true,
      smsOptedOut: false,
      dealSmsBlocked: false,
      visitsCount: 3,
      groups: [
        {
          id: 'group-1',
          name: 'VIP',
          promotionSmsEnabled: true,
        },
      ],
    },
  ],
};

const deals = {
  business,
  payoutReady: true,
  payoutSetupMessage: null,
  counts: {
    total: 2,
    live: 1,
    scheduled: 1,
    ended: 0,
  },
  deals: [
    {
      id: 'deal-1',
      title: 'Spring Special',
      description: 'Bring in new guests.',
      discountLabel: '20% off',
      statusLabel: 'Live',
      statusTone: 'live' as const,
      windowLabel: 'Mar 28 - Apr 4',
      deliveryLabel: 'Purchase link',
      purchasesCount: 2,
      redemptionsCount: 1,
      revenueLabel: '$95.00',
      linkPath: '/d/deal-1',
    },
  ],
};

const referrals = {
  business,
  referralCode: 'ABCD1234',
  payoutReady: true,
  payoutSetupMessage: null,
  totalCredits: 87,
  activeCount: 2,
  pendingCount: 1,
  referrals: [
    {
      id: 'ref-1',
      refereeName: 'North Studio',
      startedAtLabel: 'Mar 29, 2026',
      statusLabel: 'Paying',
      creditAmountLabel: '$87.00',
    },
  ],
};

const funds = {
  business,
  notConnected: false,
  payoutReady: true,
  onboardingComplete: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  availableBalanceLabel: '$18.20',
  pendingBalanceLabel: '$4.00',
  dealPendingTransferLabel: '$2.00',
  referralPendingTransferLabel: '$1.00',
  dealTransferredLabel: '$88.00',
  referralTransferredLabel: '$40.00',
  bankAccountSummary: 'Mercury ending in 1234',
  payoutScheduleSummary: 'Manual payouts',
  setupMessage: null,
  requirementTasks: [],
  recentPayouts: [],
};

const services = {
  business,
  counts: {
    services: 2,
    activeServices: 2,
    staff: 1,
    activeStaff: 1,
  },
  groups: [
    {
      id: 'group-1',
      name: 'Hair',
      sortOrder: 0,
      servicesCount: 2,
    },
  ],
  services: [
    {
      id: 'svc-1',
      name: 'Haircut',
      description: 'Classic cut',
      duration: 45,
      price: 45,
      durationLabel: '45 min',
      priceLabel: '$45.00',
      isActive: true,
      groupId: 'group-1',
      groupName: 'Hair',
      sortOrder: 0,
    },
  ],
  staff: [
    {
      id: 'staff-1',
      fullName: 'Taylor',
      email: 'taylor@example.com',
      phone: '+15551234567',
      phoneDisplay: '(555) 123-4567',
      role: 'Stylist',
      isActive: true,
      workDays: [1, 2, 3],
      workHours: {
        1: { startTime: '09:00', endTime: '17:00' },
        2: { startTime: '09:00', endTime: '17:00' },
        3: { startTime: '09:00', endTime: '17:00' },
      },
      workDaysLabel: 'Mon, Tue, Wed',
      workHoursLabel: 'Mon 09:00-17:00',
      serviceCount: 1,
      serviceIds: ['svc-1'],
      serviceNames: ['Haircut'],
    },
  ],
};

const businessHours = {
  business,
  timezone: 'America/New_York',
  timezoneLabel: 'America/New York',
  openDayCount: 5,
  closureCount: 1,
  hours: [
    {
      dayOfWeek: 1,
      label: 'Monday',
      isOpen: true,
      openTime: '09:00',
      closeTime: '17:00',
      timeRangeLabel: '9:00 AM - 5:00 PM',
    },
  ],
  closures: [
    {
      date: '2026-04-01',
      label: 'Holiday',
      formattedDate: 'Wed, Apr 1, 2026',
    },
  ],
};

const reviews = {
  business,
  storeId: 'CF-123',
  surveyPath: '/feedback/CF-123',
  surveyUrl: 'https://www.clientific.app/feedback/CF-123',
  publicReviewDestinations: [
    { label: 'Google Reviews', url: 'https://google.com/review' },
  ],
  hasPublicDestinations: true,
  recentRequestsCount: 1,
  recentRequests: [
    {
      id: 'sms-1',
      recipientLabel: '(555) 123-4567',
      statusLabel: 'Delivered',
      createdAtLabel: 'Mar 30, 1:45 PM',
    },
  ],
};

const billing = {
  business,
  currentPlanName: 'Starter',
  currentPlanPriceLabel: '$49/month',
  planSummary: 'For solo teams getting started.',
  billingProvider: 'stripe' as const,
  billingProviderLabel: 'Website',
  managementTitle: 'Managed on the web',
  managementSummary:
    'This account started on the web. Plan changes and subscription management still happen in Clientific on the web.',
  subscriptionStatus: 'active',
  subscriptionStatusLabel: 'Active',
  isActive: true,
  canPurchaseInApp: false,
  showManageInApp: false,
  trialDaysRemaining: null,
  trialEndsAtLabel: null,
  nextBillingDateLabel: 'April 30, 2026',
  paymentMethodSummary: 'VISA ending in 4242',
  invoiceEmptyState: 'No invoices have posted yet.',
  paymentMethod: {
    brand: 'visa',
    last4: '4242',
    expMonth: 12,
    expYear: 2028,
    label: 'VISA ending in 4242',
  },
  invoices: [
    {
      id: 'inv-1',
      amountLabel: '$49.00',
      createdLabel: 'Mar 30, 2026',
      status: 'paid',
      statusLabel: 'Paid',
      description: 'Starter plan',
      hostedInvoiceUrl: 'https://stripe.com/invoice/inv-1',
      invoicePdf: null,
    },
  ],
};

const aiReceptionist = {
  business,
  subscriptionPlan: 'pro',
  billingProvider: 'stripe' as const,
  hasAccess: true,
  aiReceptionistEnabled: true,
  aiReceptionistSpanishEnabled: false,
  aiReceptionistPhone: '+15557654321',
  aiReceptionistGreeting: 'Thanks for calling Clientific Studio.',
  aiReceptionistFaq: [],
  smsAiEnabled: true,
  smsAiPhoneNumber: '+18885550123',
  smsAiGreeting: 'Text us to book.',
  vapiPhoneNumber: '+18885550123',
  unifiedNumber: '+18885550123',
};

const customerView = {
  business,
  storeId: 'CF-123',
  bookingUrl: 'https://www.clientific.app/book/CF-123',
  profileUrl: 'https://www.clientific.app/business/CF-123',
  exploreUrl: 'https://www.clientific.app/explore',
  deals: [],
};

function createShellProps(
  overrides: Partial<React.ComponentProps<typeof MobileAppShell>> = {},
): React.ComponentProps<typeof MobileAppShell> {
  return {
    activeTab: 'dashboard',
    aiReceptionist,
    aiReceptionistError: null,
    appointmentComposerCustomers: customers.customers,
    appointmentComposerError: null,
    appointments,
    appointmentsError: null,
    appStoreOffering: null,
    billing,
    billingNotice: null,
    billingPurchaseError: null,
    billingError: null,
    business,
    businessHours,
    businessHoursError: null,
    businessProfile,
    businessProfileError: null,
    checkIns,
    checkInsError: null,
    customerView,
    customerViewError: null,
    customers,
    customersError: null,
    customerFilters,
    customersSearchDraft: '',
    deals,
    dealsError: null,
    funds,
    fundsError: null,
    home,
    homeError: null,
    isAiReceptionistLoading: false,
    isAiReceptionistRefreshing: false,
    isAiReceptionistSaving: false,
    isAppointmentComposerLoading: false,
    isAppointmentsLoading: false,
    isAppointmentsRefreshing: false,
    isBillingLoading: false,
    isBillingOfferingLoading: false,
    isBillingRefreshing: false,
    isManagingSubscription: false,
    isBusinessHoursLoading: false,
    isBusinessHoursRefreshing: false,
    isBusinessHoursSaving: false,
    isBusinessProfileLoading: false,
    isDeletingAccount: false,
    isCheckInsLoading: false,
    isCheckInsRefreshing: false,
    isCustomerViewLoading: false,
    isCustomerViewRefreshing: false,
    isCustomersLoading: false,
    isCustomersRefreshing: false,
    isDealsLoading: false,
    isDealsRefreshing: false,
    isFundsLoading: false,
    isFundsRefreshing: false,
    isHomeRefreshing: false,
    isPurchasingSubscription: false,
    isReferralsLoading: false,
    isReferralsRefreshing: false,
    isRestoringSubscription: false,
    isReviewsLoading: false,
    isReviewsRefreshing: false,
    isSavingBusinessProfile: false,
    isServicesLoading: false,
    isServicesRefreshing: false,
    onChangeCustomerFilters: jest.fn(),
    moreSection: 'menu',
    onChangeCustomersSearchDraft: jest.fn(),
    onChangeMoreSection: jest.fn(),
    onChangeTab: jest.fn(),
    onCreateAppointment: jest.fn().mockResolvedValue(undefined),
    onCreateAppointmentCustomer: jest.fn().mockResolvedValue(customers.customers[0]),
    onCreateCustomer: jest.fn().mockResolvedValue(undefined),
    onCreateCustomerGroup: jest.fn().mockResolvedValue(undefined),
    onCreateCheckIn: jest.fn().mockResolvedValue(undefined),
    onCreateServiceGroup: jest.fn().mockResolvedValue(undefined),
    onCreateService: jest.fn().mockResolvedValue(undefined),
    onCreateStaff: jest.fn().mockResolvedValue(undefined),
    onDeleteAccount: jest.fn().mockResolvedValue(undefined),
    onDeleteCustomer: jest.fn().mockResolvedValue(undefined),
    onDeleteCustomerGroup: jest.fn().mockResolvedValue(undefined),
    onDeleteAppointment: jest.fn().mockResolvedValue(undefined),
    onDeleteServiceGroup: jest.fn().mockResolvedValue(undefined),
    onDeleteService: jest.fn().mockResolvedValue(undefined),
    onDeleteStaff: jest.fn().mockResolvedValue(undefined),
    onFetchCustomerDetail: jest.fn().mockResolvedValue({
      id: 'cust-1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '+15551234567',
      phoneDisplay: '+15551234567',
      birthdayValue: '',
      birthdayLabel: 'Not provided',
      notes: null,
      segment: 'VIP',
      segmentLabel: 'VIP',
      joinedLabel: 'Mar 18, 2026',
      lastVisitLabel: 'Mar 29, 2026',
      totalSpentLabel: '$120.00',
      smsConsent: true,
      smsOptedOut: false,
      dealSmsBlocked: false,
      visitsCount: 3,
      appointmentsCount: 1,
      groups: [],
      checkIns: [],
      appointments: [],
    }),
    onFetchCustomerMessages: jest.fn().mockResolvedValue({ logs: [], quota: null }),
    onGoToCustomersPage: jest.fn(),
    onJumpCheckInsToToday: jest.fn(),
    onJumpAppointmentsToToday: jest.fn(),
    onLookupCheckIn: jest
      .fn()
      .mockResolvedValue({ status: 'new', normalizedPhone: '5551234567', displayPhone: '(555) 123-4567' }),
    onLookupRedeemCode: jest.fn().mockResolvedValue({
      deal: {
        title: 'Spring Special',
        discountType: 'percent_off',
        discountValue: 20,
        discountLabel: '20% off',
        platformFeePercent: 10,
      },
      customer: null,
      alreadyUsed: false,
    }),
    onLoadAppointmentComposerResources: jest.fn().mockResolvedValue(undefined),
    onNextCheckInsDate: jest.fn(),
    onNextAppointmentsDate: jest.fn(),
    onNextCustomersPage: jest.fn(),
    onManageSubscription: jest.fn().mockResolvedValue(undefined),
    onOpenExternalUrl: jest.fn().mockResolvedValue(undefined),
    onOpenAppointments: jest.fn(),
    onOpenCustomers: jest.fn(),
    onOpenDeals: jest.fn(),
    onOpenFunds: jest.fn(),
    onOpenReferrals: jest.fn(),
    onPreviousCheckInsDate: jest.fn(),
    onPreviousAppointmentsDate: jest.fn(),
    onPreviousCustomersPage: jest.fn(),
    onPurchasePackage: jest.fn().mockResolvedValue(undefined),
    onRedeemCode: jest.fn().mockResolvedValue({
      success: true,
      deal: {
        title: 'Spring Special',
        discountType: 'percent_off',
        discountValue: 20,
        discountLabel: '20% off',
      },
      customer: null,
      platformFee: 4.5,
      platformFeeLabel: '$4.50',
    }),
    onRefreshAiReceptionist: jest.fn().mockResolvedValue(undefined),
    onRefreshBilling: jest.fn().mockResolvedValue(undefined),
    onRefreshBusinessHours: jest.fn().mockResolvedValue(undefined),
    onRefreshBusinessProfile: jest.fn().mockResolvedValue(undefined),
    onRefreshCheckIns: jest.fn().mockResolvedValue(undefined),
    onRefreshAppointments: jest.fn().mockResolvedValue(undefined),
    onRefreshCustomerView: jest.fn().mockResolvedValue(undefined),
    onRefreshCustomers: jest.fn().mockResolvedValue(undefined),
    onRefreshDeals: jest.fn().mockResolvedValue(undefined),
    onRefreshFunds: jest.fn().mockResolvedValue(undefined),
    onRefreshHome: jest.fn().mockResolvedValue(undefined),
    onRefreshReferrals: jest.fn().mockResolvedValue(undefined),
    onRefreshReviews: jest.fn().mockResolvedValue(undefined),
    onRefreshServices: jest.fn().mockResolvedValue(undefined),
    onRestorePurchases: jest.fn().mockResolvedValue(undefined),
    onSaveAiReceptionist: jest.fn().mockResolvedValue(undefined),
    onSaveBusinessHours: jest.fn().mockResolvedValue(undefined),
    onSaveBusinessProfile: jest.fn().mockResolvedValue(undefined),
    onSendReviewRequest: jest.fn().mockResolvedValue(undefined),
    onSendCustomerMessage: jest.fn().mockResolvedValue(undefined),
    onShareCustomerViewLink: jest.fn().mockResolvedValue(undefined),
    onShareDeal: jest.fn().mockResolvedValue(undefined),
    onShareReferral: jest.fn().mockResolvedValue(undefined),
    onShareReviewSurvey: jest.fn().mockResolvedValue(undefined),
    onSignOut: jest.fn().mockResolvedValue(undefined),
    onReorderServiceGroups: jest.fn().mockResolvedValue(undefined),
    onReorderServices: jest.fn().mockResolvedValue(undefined),
    onUpdateAppointment: jest.fn().mockResolvedValue(undefined),
    onUpdateCustomer: jest.fn().mockResolvedValue({
      id: 'cust-1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phone: '+15551234567',
      phoneDisplay: '+15551234567',
      birthdayValue: '',
      birthdayLabel: 'Not provided',
      notes: null,
      segment: 'VIP',
      segmentLabel: 'VIP',
      joinedLabel: 'Mar 18, 2026',
      lastVisitLabel: 'Mar 29, 2026',
      totalSpentLabel: '$120.00',
      smsConsent: true,
      smsOptedOut: false,
      dealSmsBlocked: false,
      visitsCount: 3,
      appointmentsCount: 1,
      groups: [],
      checkIns: [],
      appointments: [],
    }),
    onUpdateCustomerGroup: jest.fn().mockResolvedValue(undefined),
    onUpdateServiceGroup: jest.fn().mockResolvedValue(undefined),
    onUpdateService: jest.fn().mockResolvedValue(undefined),
    onUpdateStaff: jest.fn().mockResolvedValue(undefined),
    referrals,
    referralsError: null,
    reviews,
    reviewsError: null,
    services,
    servicesError: null,
    ...overrides,
  };
}

describe('MobileAppShell', () => {
  it('renders the native home view with operator quick actions', () => {
    render(<MobileAppShell {...createShellProps()} />);

    expect(screen.getByText('Clientific Studio')).toBeTruthy();
    expect(screen.getByText('Run the day')).toBeTruthy();
    expect(screen.getByTestId('mobile-home-open-appointments')).toBeTruthy();
    expect(screen.getByTestId('mobile-home-open-checkins')).toBeTruthy();
    expect(screen.getByTestId('mobile-home-open-customers')).toBeTruthy();
    expect(screen.getByTestId('mobile-home-open-deals')).toBeTruthy();
  });

  it('wires the new tab bar', () => {
    const onChangeTab = jest.fn();

    render(<MobileAppShell {...createShellProps({ onChangeTab })} />);

    fireEvent.press(screen.getByTestId('mobile-tab-appointments'));
    expect(onChangeTab).toHaveBeenCalledWith('appointments');
  });

  it('routes the more tab back to the grouped menu', () => {
    const onChangeTab = jest.fn();
    const onChangeMoreSection = jest.fn();

    render(
      <MobileAppShell
        {...createShellProps({
          moreSection: 'checkins',
          onChangeMoreSection,
          onChangeTab,
        })}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-tab-more'));
    expect(onChangeMoreSection).toHaveBeenCalledWith('menu');
    expect(onChangeTab).toHaveBeenCalledWith('more');
  });

  it('uses a more compact bottom tab bar footprint', () => {
    render(<MobileAppShell {...createShellProps()} />);

    const tabBarStyle = StyleSheet.flatten(screen.getByTestId('mobile-tab-bar').props.style);
    const tabButtonStyle = StyleSheet.flatten(screen.getByTestId('mobile-tab-dashboard').props.style);

    expect(tabBarStyle.paddingVertical).toBe(6);
    expect(tabBarStyle.borderRadius).toBe(24);
    expect(tabButtonStyle.minHeight).toBe(48);
    expect(tabButtonStyle.borderRadius).toBe(16);
  });

  it('dims locked business tabs before the App Store trial starts', () => {
    render(
      <MobileAppShell
        {...createShellProps({
          home: {
            ...home,
            subscription: {
              plan: 'trial',
              status: 'inactive',
              billingProvider: 'none',
              isActive: false,
              requiresPurchase: true,
            },
          },
        })}
      />,
    );

    const appointmentsTabStyle = StyleSheet.flatten(
      screen.getByTestId('mobile-tab-appointments').props.style,
    );

    expect(appointmentsTabStyle.opacity).toBe(0.72);
  });
});
