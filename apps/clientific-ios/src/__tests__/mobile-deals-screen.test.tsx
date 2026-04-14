import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { MobileDealsScreen } from '@/components/mobile-deals-screen';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
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
      description: 'Bring in new clients.',
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

describe('MobileDealsScreen', () => {
  it('renders deal metrics and share actions', () => {
    const onShareDeal = jest.fn().mockResolvedValue(undefined);
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileDealsScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onOpenFunds={jest.fn()}
        onOpenUrl={onOpenUrl}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onShareDeal={onShareDeal}
      />,
    );

    expect(screen.getByText('Mobile deal board')).toBeTruthy();
    expect(screen.getByText('Spring Special')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-deal-share-deal-1'));
    expect(onShareDeal).toHaveBeenCalledWith(data.deals[0]);

    fireEvent.press(screen.getByTestId('mobile-deal-copy-deal-1'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'https://www.clientific.app/d/deal-1',
    );

    fireEvent.press(screen.getByTestId('mobile-deal-open-deal-1'));
    expect(onOpenUrl).toHaveBeenCalledWith('https://www.clientific.app/d/deal-1');
  });
});
