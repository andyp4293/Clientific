import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileScheduleScreen } from '@/components/mobile-schedule-screen';

const business = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  onboardingComplete: true,
};

function buildSchedule(selectedDate: string, dateLabel = 'Tuesday, March 31') {
  return {
    business,
    selectedDate,
    dateLabel,
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
}

describe('MobileScheduleScreen', () => {
  it('marks the Today button as selected only when viewing today', () => {
    const todayKey = new Date().toLocaleDateString('en-CA');
    const { rerender } = render(
      <MobileScheduleScreen
        data={buildSchedule(todayKey)}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onJumpToToday={jest.fn()}
        onNextDate={jest.fn()}
        onPreviousDate={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('mobile-schedule-today').props.accessibilityState).toMatchObject({
      selected: true,
    });

    rerender(
      <MobileScheduleScreen
        data={buildSchedule('2099-03-31', 'Thursday, March 31')}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onJumpToToday={jest.fn()}
        onNextDate={jest.fn()}
        onPreviousDate={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('mobile-schedule-today').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('still lets the user jump back to today', () => {
    const onJumpToToday = jest.fn();

    render(
      <MobileScheduleScreen
        data={buildSchedule('2099-03-31', 'Thursday, March 31')}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onJumpToToday={onJumpToToday}
        onNextDate={jest.fn()}
        onPreviousDate={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-schedule-today'));

    expect(onJumpToToday).toHaveBeenCalledTimes(1);
  });
});
