import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MobileFundsScreen } from '@/components/mobile-funds-screen';

const business = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  onboardingComplete: true,
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

describe('MobileFundsScreen', () => {
  it('shows a loading state while the first funds payload is still pending', () => {
    render(
      <MobileFundsScreen
        business={business}
        data={null}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Loading funds')).toBeTruthy();
    expect(
      screen.getByText('Checking Stripe access and fetching your latest payout details.'),
    ).toBeTruthy();
    expect(screen.getByText('Loading payout balances...')).toBeTruthy();
    expect(screen.queryByText('Payout setup still needs attention')).toBeNull();
  });

  it('shows the live payouts view once funds data is available', () => {
    render(
      <MobileFundsScreen
        business={business}
        data={funds}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Payouts are live')).toBeTruthy();
    expect(screen.getByText('Available now')).toBeTruthy();
    expect(screen.getByText('$18.20')).toBeTruthy();
    expect(screen.queryByText('Loading funds')).toBeNull();
  });

  it('shows a retry-oriented hero when the first funds request fails', () => {
    render(
      <MobileFundsScreen
        business={business}
        data={null}
        error="Session expired."
        isLoading={false}
        isRefreshing={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("Couldn't load funds")).toBeTruthy();
    expect(
      screen.getByText('Pull to refresh and we’ll try loading your payout workspace again.'),
    ).toBeTruthy();
    expect(screen.getByText("Couldn't refresh funds")).toBeTruthy();
    expect(screen.getByText('Session expired.')).toBeTruthy();
    expect(screen.queryByText('Payout setup still needs attention')).toBeNull();
  });
});
