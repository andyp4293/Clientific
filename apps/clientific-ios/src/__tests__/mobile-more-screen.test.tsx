import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileMoreScreen } from '@/components/mobile-more-screen';

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
  metrics: [],
  todayAppointments: [],
  referralSnapshot: {
    activeCount: 2,
    pendingCount: 1,
    lifetimeCredits: 87,
    payoutReady: true,
    setupMessage: null,
  },
  trialDaysRemaining: null,
};

const checkIns = {
  business,
  selectedDate: '2026-03-30',
  dateLabel: 'Monday, March 30',
  timezone: 'America/New_York',
  count: 1,
  latestCheckInLabel: '1:45 PM',
  checkIns: [],
};

const referrals = {
  business,
  referralCode: 'ABCD1234',
  payoutReady: true,
  payoutSetupMessage: null,
  totalCredits: 87,
  activeCount: 2,
  pendingCount: 1,
  referrals: [],
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
    { id: 'group-1', name: 'Hair', sortOrder: 0, servicesCount: 2 },
  ],
  services: [
    {
      id: 'svc-1',
      name: 'Haircut',
      description: 'Classic cut',
      duration: 45,
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
      phoneDisplay: '(555) 123-4567',
      role: 'Stylist',
      isActive: true,
      workDaysLabel: 'Mon, Tue, Wed',
      workHoursLabel: 'Mon 09:00-17:00',
      serviceCount: 1,
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

const analytics = {
  business,
  range: '30d' as const,
  stats: {
    totalRevenue: 1200,
    totalRevenueLabel: '$1,200.00',
    totalAppointments: 18,
    newCustomers: 6,
    avgRevenuePerVisit: 66.67,
    avgRevenuePerVisitLabel: '$66.67',
  },
  revenueByWeek: [
    { label: 'Mar 1', revenue: 400, revenueLabel: '$400.00' },
  ],
  appointmentsByStatus: [
    { status: 'confirmed', label: 'Confirmed', count: 10 },
  ],
  topServices: [
    { name: 'Haircut', count: 8, share: 100 },
  ],
  customerSegments: [
    { segment: 'new', label: 'New', count: 6 },
  ],
};

const billing = {
  business,
  currentPlanName: 'Starter',
  currentPlanPriceLabel: '$49/month',
  planSummary: 'For solo teams getting started.',
  subscriptionStatus: 'active',
  subscriptionStatusLabel: 'Active',
  trialDaysRemaining: null,
  trialEndsAtLabel: null,
  nextBillingDateLabel: 'April 30, 2026',
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

function createProps(
  overrides: Partial<React.ComponentProps<typeof MobileMoreScreen>> = {},
): React.ComponentProps<typeof MobileMoreScreen> {
  return {
    activeSection: 'menu',
    analytics,
    analyticsError: null,
    billing,
    billingError: null,
    business,
    businessHours,
    businessHoursError: null,
    businessProfile,
    businessProfileError: null,
    checkIns,
    checkInsError: null,
    funds,
    fundsError: null,
    home,
    isAnalyticsLoading: false,
    isAnalyticsRefreshing: false,
    isBillingLoading: false,
    isBillingPortalOpening: false,
    isBillingRefreshing: false,
    isBusinessHoursLoading: false,
    isBusinessHoursRefreshing: false,
    isBusinessHoursSaving: false,
    isBusinessProfileLoading: false,
    isCheckInsLoading: false,
    isCheckInsRefreshing: false,
    isFundsLoading: false,
    isFundsRefreshing: false,
    isReferralsLoading: false,
    isReferralsRefreshing: false,
    isReviewsLoading: false,
    isReviewsRefreshing: false,
    isSavingBusinessProfile: false,
    isServicesLoading: false,
    isServicesRefreshing: false,
    onChangeAnalyticsRange: jest.fn(),
    onChangeSection: jest.fn(),
    onCreateCheckIn: jest.fn().mockResolvedValue(undefined),
    onJumpCheckInsToToday: jest.fn(),
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
    onNextCheckInsDate: jest.fn(),
    onOpenBillingPortal: jest.fn().mockResolvedValue(undefined),
    onOpenExternalRoute: jest.fn().mockResolvedValue(undefined),
    onOpenExternalUrl: jest.fn().mockResolvedValue(undefined),
    onPreviousCheckInsDate: jest.fn(),
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
    onRefreshAnalytics: jest.fn().mockResolvedValue(undefined),
    onRefreshBilling: jest.fn().mockResolvedValue(undefined),
    onRefreshBusinessHours: jest.fn().mockResolvedValue(undefined),
    onRefreshBusinessProfile: jest.fn().mockResolvedValue(undefined),
    onRefreshCheckIns: jest.fn().mockResolvedValue(undefined),
    onRefreshFunds: jest.fn().mockResolvedValue(undefined),
    onRefreshReferrals: jest.fn().mockResolvedValue(undefined),
    onRefreshReviews: jest.fn().mockResolvedValue(undefined),
    onRefreshServices: jest.fn().mockResolvedValue(undefined),
    onSaveBusinessHours: jest.fn().mockResolvedValue(undefined),
    onSaveBusinessProfile: jest.fn().mockResolvedValue(undefined),
    onShareReferral: jest.fn().mockResolvedValue(undefined),
    onShareReviewSurvey: jest.fn().mockResolvedValue(undefined),
    onSignOut: jest.fn().mockResolvedValue(undefined),
    referrals,
    referralsError: null,
    reviews,
    reviewsError: null,
    services,
    servicesError: null,
    ...overrides,
  };
}

describe('MobileMoreScreen', () => {
  it('shows the fuller grouped menu from the web app', () => {
    render(<MobileMoreScreen {...createProps()} />);

    expect(screen.getByText('Operations')).toBeTruthy();
    expect(screen.getByText('Growth')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Services & Staff')).toBeTruthy();
    expect(screen.getByText('Check-ins')).toBeTruthy();
    expect(screen.getByText('Refer & Earn')).toBeTruthy();
    expect(screen.getByText('Payouts')).toBeTruthy();
    expect(screen.getByText('Billing')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('routes native destinations inside the app', () => {
    const onChangeSection = jest.fn();

    render(<MobileMoreScreen {...createProps({ onChangeSection })} />);

    fireEvent.press(screen.getByTestId('mobile-more-menu-analytics'));
    expect(onChangeSection).toHaveBeenCalledWith('analytics');
  });

  it('opens browser-backed pages for tools that are not native yet', () => {
    const onOpenExternalRoute = jest.fn().mockResolvedValue(undefined);

    render(<MobileMoreScreen {...createProps({ onOpenExternalRoute })} />);

    fireEvent.press(screen.getByTestId('mobile-more-menu-ai-receptionist'));
    expect(onOpenExternalRoute).toHaveBeenCalledWith('/dashboard/ai-receptionist');
  });

  it('renders the settings editor when settings is selected', () => {
    render(<MobileMoreScreen {...createProps({ activeSection: 'settings' })} />);

    expect(screen.getByText('Business settings')).toBeTruthy();
    expect(screen.getByText('Save changes')).toBeTruthy();
  });

  it('renders native billing tools when billing is selected', () => {
    render(<MobileMoreScreen {...createProps({ activeSection: 'billing' })} />);

    expect(screen.getByText('Plan and invoices')).toBeTruthy();
    expect(screen.getByTestId('mobile-billing-open-portal')).toBeTruthy();
  });
});
