import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MobileCheckinsScreen } from '@/components/mobile-checkins-screen';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    publicId: 'CF-8QXLBD',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  selectedDate: '2099-03-30',
  dateLabel: 'Monday, March 30',
  timezone: 'America/New_York',
  count: 1,
  latestCheckInLabel: '1:45 PM',
  checkIns: [],
};

function renderScreen(
  overrides: Partial<React.ComponentProps<typeof MobileCheckinsScreen>> = {},
) {
  return render(
    <MobileCheckinsScreen
      data={data}
      error={null}
      isLoading={false}
      isRefreshing={false}
      onJumpToToday={jest.fn()}
      onLookup={jest.fn()}
      onNextDate={jest.fn()}
      onPreviousDate={jest.fn()}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
      onSelectDate={jest.fn()}
      onSubmit={jest.fn()}
      {...overrides}
    />,
  );
}

function expectNativeContinueDisabled(isDisabled: boolean) {
  expect(screen.getByTestId('mobile-checkins-native-continue').props.accessibilityState).toEqual({
    disabled: isDisabled,
  });
}

describe('MobileCheckinsScreen', () => {
  it('copies the public device link but opens check-in inside the native app', async () => {
    renderScreen();

    expect(screen.getByText('In-store check-in')).toBeTruthy();
    expect(screen.getByText('Device link')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-checkins-copy-link'));
    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        'https://www.clientific.app/check-in/CF-8QXLBD',
      );
    });

    fireEvent.press(screen.getByTestId('mobile-checkins-open-link'));
    expect(screen.getByTestId('mobile-checkins-native-page')).toBeTruthy();
    expect(screen.getByText('In-app check-in')).toBeTruthy();
    expect(screen.getByText('Clientific Studio')).toBeTruthy();
  });

  it('runs the in-app keypad check-in without opening a website', async () => {
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
    const onRefresh = jest.fn().mockResolvedValue(undefined);

    renderScreen({ onLookup, onRefresh, onSubmit });

    fireEvent.press(screen.getByTestId('mobile-checkins-open-link'));
    expectNativeContinueDisabled(true);

    for (const digit of '5551234567') {
      fireEvent.press(screen.getByTestId(`mobile-checkins-native-key-${digit}`));
    }

    expect(screen.getByTestId('mobile-checkins-native-phone-display').props.children).toBe(
      '(555) 123-4567',
    );
    expectNativeContinueDisabled(false);

    fireEvent.press(screen.getByTestId('mobile-checkins-native-continue'));

    await waitFor(() => {
      expect(onLookup).toHaveBeenCalledWith('5551234567');
      expect(onSubmit).toHaveBeenCalledWith({ customerId: 'cust-1' });
      expect(onRefresh).toHaveBeenCalled();
    });

    expect(screen.getByText('Jordan Lee checked in at 1:45 PM.')).toBeTruthy();
  });

  it('supports delete and clear in the in-app keypad flow', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('mobile-checkins-open-link'));
    for (const digit of '5551234567') {
      fireEvent.press(screen.getByTestId(`mobile-checkins-native-key-${digit}`));
    }

    fireEvent.press(screen.getByTestId('mobile-checkins-native-key-back'));
    expect(screen.getByTestId('mobile-checkins-native-phone-display').props.children).toBe(
      '(555) 123-456',
    );
    expectNativeContinueDisabled(true);

    fireEvent.press(screen.getByTestId('mobile-checkins-native-key-clear'));
    expect(screen.getByTestId('mobile-checkins-native-phone-display').props.children).toBe(
      '(___) ___-____',
    );
  });

  it('opens the calendar picker and lets the operator choose another day', () => {
    const onSelectDate = jest.fn();

    renderScreen({ onSelectDate });

    fireEvent.press(screen.getByTestId('mobile-checkins-open-calendar'));
    expect(screen.getByTestId('mobile-checkins-calendar-next-month')).toBeTruthy();
    expect(screen.getByTestId('mobile-checkins-calendar-previous-month')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-checkins-calendar-next-month'));
    fireEvent.press(screen.getByTestId('mobile-checkins-calendar-day-2099-04-01'));

    expect(onSelectDate).toHaveBeenCalledWith('2099-04-01');
  });

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

    renderScreen({
      onLookup,
      onSubmit,
    });

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
