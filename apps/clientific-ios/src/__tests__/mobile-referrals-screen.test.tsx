import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { MobileReferralsScreen } from '@/components/mobile-referrals-screen';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

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
    expect(screen.getByTestId('mobile-referrals-creator-kit')).toBeTruthy();
    expect(screen.getByTestId('mobile-referrals-creator-brief')).toBeTruthy();
    expect(
      screen.getByText(/creators should make their own free partner account/i),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-referrals-copy-link'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'https://www.clientific.app/register?ref=ABCD1234',
    );

    fireEvent.press(screen.getByTestId('mobile-referrals-copy-code'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABCD1234');

    fireEvent.press(screen.getByTestId('mobile-referrals-copy-creator-brief'));
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('https://www.clientific.app/partner'),
    );
    expect((Clipboard.setStringAsync as jest.Mock).mock.calls.at(-1)?.[0]).not.toContain(
      'ref=ABCD1234',
    );

    fireEvent.press(screen.getByTestId('mobile-referrals-copy-creator-caption'));
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('online booking'),
    );
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
    expect(screen.getByTestId('mobile-referrals-creator-kit')).toBeTruthy();
  });
});
