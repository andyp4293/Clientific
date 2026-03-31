import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileCustomersScreen } from '@/components/mobile-customers-screen';

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  search: '',
  currentPage: 1,
  totalPages: 3,
  totalCustomers: 55,
  pageSize: 20,
  customers: [
    {
      id: 'cust-1',
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      phoneDisplay: '(555) 123-4567',
      joinedLabel: 'Mar 18, 2026',
      lastVisitLabel: 'Mar 29, 2026',
      totalSpentLabel: '$120.00',
      smsConsent: true,
      smsOptedOut: false,
      dealSmsBlocked: false,
      visitsCount: 3,
      groups: [],
    },
  ],
};

describe('MobileCustomersScreen', () => {
  it('wires search and pagination controls', () => {
    const onChangeSearchDraft = jest.fn();
    const onNextPage = jest.fn();

    render(
      <MobileCustomersScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        searchDraft=""
        onChangeSearchDraft={onChangeSearchDraft}
        onNextPage={onNextPage}
        onPreviousPage={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-customers-search'), 'jord');
    fireEvent.press(screen.getByTestId('mobile-customers-next'));

    expect(onChangeSearchDraft).toHaveBeenCalledWith('jord');
    expect(onNextPage).toHaveBeenCalled();
  });
});
