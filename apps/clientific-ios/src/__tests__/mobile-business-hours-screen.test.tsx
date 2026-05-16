import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MobileBusinessHoursScreen } from '@/components/mobile-business-hours-screen';

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  timezone: 'America/New_York',
  timezoneLabel: 'America/New York',
  openDayCount: 5,
  closureCount: 1,
  hours: [
    {
      dayOfWeek: 1,
      label: 'Monday',
      isOpen: true,
      openTime: '09:00',
      closeTime: '17:00',
      timeRangeLabel: '9:00 AM - 5:00 PM',
    },
  ],
  closures: [
    {
      date: '2026-04-01',
      label: 'Holiday',
      formattedDate: 'Wed, Apr 1, 2026',
    },
  ],
};

describe('MobileBusinessHoursScreen', () => {
  it('shows business hours as AM/PM and saves normalized 24-hour values', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileBusinessHoursScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={onSave}
      />,
    );

    expect(screen.getByText('9:00 AM - 5:00 PM')).toBeTruthy();
    expect(screen.queryByText('09:00 - 17:00')).toBeNull();
    expect(screen.getByDisplayValue('9:00 AM')).toBeTruthy();
    expect(screen.getByDisplayValue('5:00 PM')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('mobile-business-hours-open-1'), '9:30 AM');
    fireEvent.changeText(screen.getByTestId('mobile-business-hours-close-1'), '6:15 PM');
    fireEvent.press(screen.getByTestId('mobile-business-hours-save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          hours: [
            expect.objectContaining({
              dayOfWeek: 1,
              isOpen: true,
              openTime: '09:30',
              closeTime: '18:15',
            }),
          ],
        }),
      );
    });
  });

  it('blocks invalid AM/PM business hours before saving', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileBusinessHoursScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={onSave}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-business-hours-open-1'), '6:00 PM');
    fireEvent.changeText(screen.getByTestId('mobile-business-hours-close-1'), '5:00 PM');
    fireEvent.press(screen.getByTestId('mobile-business-hours-save'));

    expect(screen.getByText('Monday closing time must be after opening time.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('adds a closure and saves the updated schedule', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileBusinessHoursScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        isSaving={false}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSave={onSave}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-business-hours-tab-closures'));
    fireEvent.changeText(
      screen.getByTestId('mobile-business-hours-new-closure-date'),
      '2026-04-15',
    );
    fireEvent.changeText(
      screen.getByTestId('mobile-business-hours-new-closure-label'),
      'Team retreat',
    );
    fireEvent.press(screen.getByTestId('mobile-business-hours-add-closure'));
    fireEvent.press(screen.getByTestId('mobile-business-hours-save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        hours: [
          {
            dayOfWeek: 1,
            isOpen: true,
            openTime: '09:00',
            closeTime: '17:00',
          },
        ],
        closures: [
          {
            date: '2026-04-01',
            label: 'Holiday',
          },
          {
            date: '2026-04-15',
            label: 'Team retreat',
          },
        ],
      });
    });
  });
});
