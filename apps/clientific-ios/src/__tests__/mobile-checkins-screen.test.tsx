import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MobileCheckinsScreen } from '@/components/mobile-checkins-screen';

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  selectedDate: '2026-03-30',
  dateLabel: 'Monday, March 30',
  timezone: 'America/New_York',
  count: 1,
  latestCheckInLabel: '1:45 PM',
  checkIns: [],
};

describe('MobileCheckinsScreen', () => {
  it('looks up a customer and submits a quick check-in', async () => {
    const onLookup = jest.fn().mockResolvedValue({
      status: 'existing',
      customer: {
        id: 'cust-1',
        name: 'Jordan Lee',
        phone: '+15551234567',
        email: 'jordan@example.com',
        phoneDisplay: '(555) 123-4567',
        lastVisitLabel: 'Mar 20, 2026',
      },
    });
    const onSubmit = jest.fn().mockResolvedValue({
      checkIn: {
        id: 'check-1',
        customerId: 'cust-1',
        customerName: 'Jordan Lee',
        phoneDisplay: '(555) 123-4567',
        serviceName: null,
        staffName: null,
        amountSpentLabel: null,
        checkedInAtLabel: '1:45 PM',
        lastVisitLabel: 'Mar 20, 2026',
      },
    });

    render(
      <MobileCheckinsScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onJumpToToday={jest.fn()}
        onLookup={onLookup}
        onNextDate={jest.fn()}
        onPreviousDate={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-checkins-phone-input'), '5551234567');
    fireEvent.press(screen.getByTestId('mobile-checkins-lookup'));

    await waitFor(() => {
      expect(screen.getByText('Jordan Lee')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mobile-checkins-submit-existing'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        customerId: 'cust-1',
      });
    });
  });
});
