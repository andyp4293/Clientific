import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileNotificationsScreen } from '@/components/mobile-notifications-screen';

const business = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  onboardingComplete: true,
};

const notifications = {
  business,
  unreadCount: 1,
  notifications: [
    {
      id: 'notif-1',
      type: 'new_appointment',
      title: 'New appointment booked',
      message: 'Jordan Lee booked Haircut for 11:30 AM.',
      link: '/dashboard/appointments',
      read: false,
      createdAt: '2026-05-08T10:30:00.000Z',
      createdAtLabel: 'May 8, 10:30 AM',
    },
  ],
};

describe('MobileNotificationsScreen', () => {
  it('renders notification content and lets the owner open an item', () => {
    const onOpenNotification = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileNotificationsScreen
        data={notifications}
        error={null}
        isLoading={false}
        isMarkingRead={false}
        isRefreshing={false}
        permissionStatus="granted"
        onEnablePush={jest.fn().mockResolvedValue(undefined)}
        onMarkAllRead={jest.fn().mockResolvedValue(undefined)}
        onOpenNotification={onOpenNotification}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Owner alerts')).toBeTruthy();
    expect(screen.getByText('Push alerts are on')).toBeTruthy();
    expect(screen.getByText('New appointment booked')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-notifications-row-notif-1'));

    expect(onOpenNotification).toHaveBeenCalledWith(notifications.notifications[0]);
  });

  it('shows a settings prompt when push permissions are denied', () => {
    const onEnablePush = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileNotificationsScreen
        data={notifications}
        error={null}
        isLoading={false}
        isMarkingRead={false}
        isRefreshing={false}
        permissionStatus="denied"
        onEnablePush={onEnablePush}
        onMarkAllRead={jest.fn().mockResolvedValue(undefined)}
        onOpenNotification={jest.fn().mockResolvedValue(undefined)}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Push alerts are off')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-notifications-enable-push'));

    expect(onEnablePush).toHaveBeenCalledTimes(1);
  });

  it('lets the owner mark all notifications as read', () => {
    const onMarkAllRead = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileNotificationsScreen
        data={notifications}
        error={null}
        isLoading={false}
        isMarkingRead={false}
        isRefreshing={false}
        permissionStatus="granted"
        onEnablePush={jest.fn().mockResolvedValue(undefined)}
        onMarkAllRead={onMarkAllRead}
        onOpenNotification={jest.fn().mockResolvedValue(undefined)}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-notifications-mark-read'));

    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });
});
