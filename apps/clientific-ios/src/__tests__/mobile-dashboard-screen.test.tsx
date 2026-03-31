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
  business,
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
      customerName: 'Jordan Lee',
      serviceName: 'Haircut',
      staffName: 'Taylor',
      status: 'confirmed',
      statusLabel: 'Confirmed',
      startTimeLabel: '11:30 AM',
      endTimeLabel: '12:15 PM',
      sourceLabel: 'Manual',
      notes: null,
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

const customers = {
  business,
  search: '',
  currentPage: 1,
  totalPages: 2,
  totalCustomers: 21,
  pageSize: 20,
  customers: [
    {
      id: 'cust-1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phoneDisplay: '+15551234567',
      joinedLabel: 'Mar 18, 2026',
      lastVisitLabel: 'Mar 29, 2026',
      totalSpentLabel: '$120.00',
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

function renderShell() {
  return render(
    <MobileAppShell
      activeTab="home"
      appointments={appointments}
      appointmentsError={null}
      business={business}
      checkIns={checkIns}
      checkInsError={null}
      customers={customers}
      customersError={null}
      customersSearchDraft=""
      funds={funds}
      fundsError={null}
      home={home}
      homeError={null}
      isAppointmentsLoading={false}
      isAppointmentsRefreshing={false}
      isCheckInsLoading={false}
      isCheckInsRefreshing={false}
      isCustomersLoading={false}
      isCustomersRefreshing={false}
      isFundsLoading={false}
      isFundsRefreshing={false}
      isHomeRefreshing={false}
      isReferralsLoading={false}
      isReferralsRefreshing={false}
      moreSection="referrals"
      onChangeCustomersSearchDraft={jest.fn()}
      onChangeMoreSection={jest.fn()}
      onChangeTab={jest.fn()}
      onCreateCheckIn={jest.fn().mockResolvedValue(undefined)}
      onJumpAppointmentsToToday={jest.fn()}
      onJumpCheckInsToToday={jest.fn()}
      onLookupCheckIn={jest.fn().mockResolvedValue({ status: 'new', normalizedPhone: '5551234567', displayPhone: '(555) 123-4567' })}
      onNextAppointmentsDate={jest.fn()}
      onNextCheckInsDate={jest.fn()}
      onNextCustomersPage={jest.fn()}
      onOpenCheckIns={jest.fn()}
      onOpenCustomers={jest.fn()}
      onOpenFunds={jest.fn()}
      onOpenReferrals={jest.fn()}
      onOpenSchedule={jest.fn()}
      onPreviousAppointmentsDate={jest.fn()}
      onPreviousCheckInsDate={jest.fn()}
      onPreviousCustomersPage={jest.fn()}
      onRefreshAppointments={jest.fn().mockResolvedValue(undefined)}
      onRefreshCheckIns={jest.fn().mockResolvedValue(undefined)}
      onRefreshCustomers={jest.fn().mockResolvedValue(undefined)}
      onRefreshFunds={jest.fn().mockResolvedValue(undefined)}
      onRefreshHome={jest.fn().mockResolvedValue(undefined)}
      onRefreshReferrals={jest.fn().mockResolvedValue(undefined)}
      onShareReferral={jest.fn().mockResolvedValue(undefined)}
      onSignOut={jest.fn().mockResolvedValue(undefined)}
      referrals={referrals}
      referralsError={null}
    />,
  );
}

describe('MobileAppShell', () => {
  it('renders the native home view with operator quick actions', () => {
    renderShell();

    expect(screen.getByText('Clientific Studio')).toBeTruthy();
    expect(screen.getByText('Run the day')).toBeTruthy();
    expect(screen.getByTestId('mobile-home-open-schedule')).toBeTruthy();
    expect(screen.getByTestId('mobile-home-open-checkins')).toBeTruthy();
    expect(screen.getByTestId('mobile-home-open-customers')).toBeTruthy();
  });

  it('wires the new tab bar', () => {
    const onChangeTab = jest.fn();

    render(
      <MobileAppShell
        activeTab="home"
        appointments={appointments}
        appointmentsError={null}
        business={business}
        checkIns={checkIns}
        checkInsError={null}
        customers={customers}
        customersError={null}
        customersSearchDraft=""
        funds={funds}
        fundsError={null}
        home={home}
        homeError={null}
        isAppointmentsLoading={false}
        isAppointmentsRefreshing={false}
        isCheckInsLoading={false}
        isCheckInsRefreshing={false}
        isCustomersLoading={false}
        isCustomersRefreshing={false}
        isFundsLoading={false}
        isFundsRefreshing={false}
        isHomeRefreshing={false}
        isReferralsLoading={false}
        isReferralsRefreshing={false}
        moreSection="referrals"
        onChangeCustomersSearchDraft={jest.fn()}
        onChangeMoreSection={jest.fn()}
        onChangeTab={onChangeTab}
        onCreateCheckIn={jest.fn().mockResolvedValue(undefined)}
        onJumpAppointmentsToToday={jest.fn()}
        onJumpCheckInsToToday={jest.fn()}
        onLookupCheckIn={jest.fn().mockResolvedValue({ status: 'new', normalizedPhone: '5551234567', displayPhone: '(555) 123-4567' })}
        onNextAppointmentsDate={jest.fn()}
        onNextCheckInsDate={jest.fn()}
        onNextCustomersPage={jest.fn()}
        onOpenCheckIns={jest.fn()}
        onOpenCustomers={jest.fn()}
        onOpenFunds={jest.fn()}
        onOpenReferrals={jest.fn()}
        onOpenSchedule={jest.fn()}
        onPreviousAppointmentsDate={jest.fn()}
        onPreviousCheckInsDate={jest.fn()}
        onPreviousCustomersPage={jest.fn()}
        onRefreshAppointments={jest.fn().mockResolvedValue(undefined)}
        onRefreshCheckIns={jest.fn().mockResolvedValue(undefined)}
        onRefreshCustomers={jest.fn().mockResolvedValue(undefined)}
        onRefreshFunds={jest.fn().mockResolvedValue(undefined)}
        onRefreshHome={jest.fn().mockResolvedValue(undefined)}
        onRefreshReferrals={jest.fn().mockResolvedValue(undefined)}
        onShareReferral={jest.fn().mockResolvedValue(undefined)}
        onSignOut={jest.fn().mockResolvedValue(undefined)}
        referrals={referrals}
        referralsError={null}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-tab-schedule'));
    expect(onChangeTab).toHaveBeenCalledWith('schedule');
  });
});
