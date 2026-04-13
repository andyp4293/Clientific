import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MobileReferralsScreen } from '@/components/mobile-referrals-screen';

const business = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  onboardingComplete: true,
};

describe('MobileReferralsScreen', () => {
  it('shows both the shareable referral link and the fallback code', () => {
    render(
      <MobileReferralsScreen
        business={business}
        data={{
          business,
          referralCode: 'ABCD1234',
          payoutReady: true,
          payoutSetupMessage: null,
          totalCredits: 87,
          activeCount: 2,
          pendingCount: 1,
          referrals: [],
        }}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onOpenFunds={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onShare={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Referral link')).toBeTruthy();
    expect(
      screen.getByText('https://www.clientific.app/register?ref=ABCD1234'),
    ).toBeTruthy();
    expect(screen.getByText('Fallback code')).toBeTruthy();
    expect(screen.getByText('ABCD1234')).toBeTruthy();
    expect(screen.getByTestId('mobile-referrals-share')).toBeTruthy();
  });

  it('keeps sharing locked until payouts are ready', () => {
    render(
      <MobileReferralsScreen
        business={business}
        data={{
          business,
          referralCode: null,
          payoutReady: false,
          payoutSetupMessage: 'Finish payout setup first.',
          totalCredits: 0,
          activeCount: 0,
          pendingCount: 0,
          referrals: [],
        }}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onOpenFunds={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onShare={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Finish payouts before sharing')).toBeTruthy();
    expect(screen.queryByText('Referral link')).toBeNull();
    expect(screen.queryByText('Fallback code')).toBeNull();
  });
});
