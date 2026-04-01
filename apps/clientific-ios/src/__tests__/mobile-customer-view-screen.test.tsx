import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileCustomerViewScreen } from '@/components/mobile-customer-view-screen';

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  storeId: 'CF-123',
  bookingUrl: 'https://www.clientific.app/book/CF-123',
  profileUrl: 'https://www.clientific.app/business/CF-123',
  exploreUrl: 'https://www.clientific.app/explore',
  deals: [
    {
      id: 'deal-1',
      title: 'Spring Special',
      discountLabel: '20% off',
      url: 'https://www.clientific.app/d/deal-1',
    },
  ],
};

describe('MobileCustomerViewScreen', () => {
  it('shares and opens customer-facing links from the native screen', () => {
    const onShareLink = jest.fn().mockResolvedValue(undefined);
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileCustomerViewScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onOpenUrl={onOpenUrl}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onShareLink={onShareLink}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-customer-view-booking-share'));
    fireEvent.press(screen.getByTestId('mobile-customer-view-open-deal-deal-1'));

    expect(onShareLink).toHaveBeenCalledWith('Booking page', data.bookingUrl);
    expect(onOpenUrl).toHaveBeenCalledWith(data.deals[0].url);
  });

  it('shows the empty deal state when there are no active deals', () => {
    render(
      <MobileCustomerViewScreen
        data={{ ...data, deals: [] }}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onOpenUrl={jest.fn().mockResolvedValue(undefined)}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onShareLink={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('No active deals are live right now.')).toBeTruthy();
  });
});
