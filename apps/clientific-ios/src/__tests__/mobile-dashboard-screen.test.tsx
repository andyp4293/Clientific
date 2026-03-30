import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileAppShell } from '@/components/mobile-app-shell';

const business = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  onboardingComplete: true,
};

const home = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
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

describe('MobileAppShell', () => {
  it('renders the mobile home view', () => {
    render(
      <MobileAppShell
        activeTab="home"
        business={business}
        funds={funds}
        fundsError={null}
        home={home}
        homeError={null}
        isFundsLoading={false}
        isFundsRefreshing={false}
        isHomeRefreshing={false}
        isReferralsLoading={false}
        isReferralsRefreshing={false}
        onChangeTab={jest.fn()}
        onOpenFunds={jest.fn()}
        onOpenReferrals={jest.fn()}
        onRefreshFunds={jest.fn().mockResolvedValue(undefined)}
        onRefreshHome={jest.fn().mockResolvedValue(undefined)}
        onRefreshReferrals={jest.fn().mockResolvedValue(undefined)}
        onShareReferral={jest.fn().mockResolvedValue(undefined)}
        onSignOut={jest.fn().mockResolvedValue(undefined)}
        referrals={referrals}
        referralsError={null}
      />,
    );

    expect(screen.getByText('Clientific Studio')).toBeTruthy();
    expect(screen.getByText('Booked today')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Jordan Lee')).toBeTruthy();
  });

  it('wires tab changes', () => {
    const onChangeTab = jest.fn();

    render(
      <MobileAppShell
        activeTab="home"
        business={business}
        funds={funds}
        fundsError={null}
        home={home}
        homeError={null}
        isFundsLoading={false}
        isFundsRefreshing={false}
        isHomeRefreshing={false}
        isReferralsLoading={false}
        isReferralsRefreshing={false}
        onChangeTab={onChangeTab}
        onOpenFunds={jest.fn()}
        onOpenReferrals={jest.fn()}
        onRefreshFunds={jest.fn().mockResolvedValue(undefined)}
        onRefreshHome={jest.fn().mockResolvedValue(undefined)}
        onRefreshReferrals={jest.fn().mockResolvedValue(undefined)}
        onShareReferral={jest.fn().mockResolvedValue(undefined)}
        onSignOut={jest.fn().mockResolvedValue(undefined)}
        referrals={referrals}
        referralsError={null}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-tab-referrals'));
    expect(onChangeTab).toHaveBeenCalledWith('referrals');
  });
});
