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

function renderScreen(activeSection: React.ComponentProps<typeof MobileMoreScreen>['activeSection']) {
  const onChangeSection = jest.fn();
  const onOpenExternalRoute = jest.fn().mockResolvedValue(undefined);

  render(
    <MobileMoreScreen
      activeSection={activeSection}
      business={business}
      businessProfile={businessProfile}
      businessProfileError={null}
      checkIns={checkIns}
      checkInsError={null}
      funds={funds}
      fundsError={null}
      home={home}
      isBusinessProfileLoading={false}
      isCheckInsLoading={false}
      isCheckInsRefreshing={false}
      isFundsLoading={false}
      isFundsRefreshing={false}
      isReferralsLoading={false}
      isReferralsRefreshing={false}
      isSavingBusinessProfile={false}
      onChangeSection={onChangeSection}
      onCreateCheckIn={jest.fn().mockResolvedValue(undefined)}
      onJumpCheckInsToToday={jest.fn()}
      onLookupCheckIn={jest.fn().mockResolvedValue({ status: 'new', normalizedPhone: '5551234567', displayPhone: '(555) 123-4567' })}
      onNextCheckInsDate={jest.fn()}
      onOpenExternalRoute={onOpenExternalRoute}
      onPreviousCheckInsDate={jest.fn()}
      onRefreshBusinessProfile={jest.fn().mockResolvedValue(undefined)}
      onRefreshCheckIns={jest.fn().mockResolvedValue(undefined)}
      onRefreshFunds={jest.fn().mockResolvedValue(undefined)}
      onRefreshReferrals={jest.fn().mockResolvedValue(undefined)}
      onSaveBusinessProfile={jest.fn().mockResolvedValue(undefined)}
      onShareReferral={jest.fn().mockResolvedValue(undefined)}
      onSignOut={jest.fn().mockResolvedValue(undefined)}
      referrals={referrals}
      referralsError={null}
    />,
  );

  return { onChangeSection, onOpenExternalRoute };
}

describe('MobileMoreScreen', () => {
  it('shows the fuller grouped menu from the web app', () => {
    renderScreen('menu');

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
    const { onChangeSection } = renderScreen('menu');

    fireEvent.press(screen.getByTestId('mobile-more-menu-settings'));
    expect(onChangeSection).toHaveBeenCalledWith('settings');
  });

  it('opens browser-backed pages for tools that are not native yet', () => {
    const { onOpenExternalRoute } = renderScreen('menu');

    fireEvent.press(screen.getByTestId('mobile-more-menu-analytics'));
    expect(onOpenExternalRoute).toHaveBeenCalledWith('/dashboard/analytics');
  });

  it('renders the settings editor when settings is selected', () => {
    renderScreen('settings');

    expect(screen.getByText('Business settings')).toBeTruthy();
    expect(screen.getByText('Save changes')).toBeTruthy();
  });
});
