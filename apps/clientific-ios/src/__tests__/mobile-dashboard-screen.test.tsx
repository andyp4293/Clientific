import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileDashboardScreen } from '@/components/mobile-dashboard-screen';

const summary = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    onboardingComplete: true,
  },
  metrics: [
    { label: 'Customers', value: 42, helper: '+6 this month' },
    { label: 'Appointments Today', value: 3, helper: 'Scheduled' },
  ],
  upcomingAppointments: [
    {
      id: 'appt-1',
      customerName: 'Jordan Lee',
      serviceName: 'Haircut',
      status: 'confirmed',
      startTime: '2026-03-30T15:30:00.000Z',
      startTimeLabel: '11:30 AM',
    },
  ],
  trialDaysRemaining: null,
};

describe('MobileDashboardScreen', () => {
  it('renders dashboard metrics and appointments', () => {
    render(
      <MobileDashboardScreen
        error={null}
        isRefreshing={false}
        summary={summary}
        onOpenWorkspace={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSignOut={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Clientific Studio')).toBeTruthy();
    expect(screen.getByText('Customers')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Jordan Lee')).toBeTruthy();
  });

  it('wires the refresh action', () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileDashboardScreen
        error={null}
        isRefreshing={false}
        summary={summary}
        onOpenWorkspace={jest.fn()}
        onRefresh={onRefresh}
        onSignOut={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-dashboard-refresh'));
    expect(onRefresh).toHaveBeenCalled();
  });
});
