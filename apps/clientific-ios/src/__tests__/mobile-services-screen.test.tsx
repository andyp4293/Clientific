import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MobileServicesScreen } from '@/components/mobile-services-screen';
import type { MobileServicesSummary } from '@/lib/clientific-api';

const data: MobileServicesSummary = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  counts: {
    services: 1,
    activeServices: 1,
    staff: 1,
    activeStaff: 1,
  },
  groups: [
    {
      id: 'group-1',
      name: 'Hair',
      sortOrder: 0,
      servicesCount: 1,
    },
  ],
  services: [
    {
      id: 'svc-1',
      name: 'Haircut',
      description: 'Classic cut',
      duration: 45,
      durationLabel: '45 min',
      price: 45,
      priceLabel: '$45.00',
      isActive: true,
      groupId: 'group-1',
      groupName: 'Hair',
      sortOrder: 0,
    },
  ],
  staff: [
    {
      id: 'staff-1',
      fullName: 'Taylor',
      email: 'taylor@example.com',
      phone: '+15557654321',
      phoneDisplay: '(555) 765-4321',
      role: 'Stylist',
      isActive: true,
      workDays: [1, 2],
      workHours: {
        1: { startTime: '09:00', endTime: '17:00' },
        2: { startTime: '10:00', endTime: '18:00' },
      },
      workDaysLabel: 'Mon, Tue',
      workHoursLabel: 'Mon 09:00-17:00 • Tue 10:00-18:00',
      serviceCount: 1,
      serviceIds: ['svc-1'],
      serviceNames: ['Haircut'],
    },
  ],
};

function renderScreen(overrides?: Partial<React.ComponentProps<typeof MobileServicesScreen>>) {
  return render(
    <MobileServicesScreen
      data={data}
      error={null}
      isLoading={false}
      isRefreshing={false}
      onCreateService={jest.fn().mockResolvedValue(undefined)}
      onCreateStaff={jest.fn().mockResolvedValue(undefined)}
      onDeleteService={jest.fn().mockResolvedValue(undefined)}
      onDeleteStaff={jest.fn().mockResolvedValue(undefined)}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
      onUpdateService={jest.fn().mockResolvedValue(undefined)}
      onUpdateStaff={jest.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );
}

describe('MobileServicesScreen', () => {
  it('creates a service from the native form', async () => {
    const onCreateService = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onCreateService });

    fireEvent.press(screen.getByTestId('mobile-add-service'));
    fireEvent.changeText(screen.getByPlaceholderText('Classic manicure'), 'Balayage');
    fireEvent.changeText(screen.getByPlaceholderText('60'), '90');
    fireEvent.changeText(screen.getByPlaceholderText('45'), '120');
    fireEvent.press(screen.getByTestId('mobile-save-service'));

    await waitFor(() => {
      expect(onCreateService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Balayage',
          duration: 90,
          price: 120,
          groupId: null,
        }),
      );
    });
  });

  it('creates a staff member from the native form', async () => {
    const onCreateStaff = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onCreateStaff });

    fireEvent.press(screen.getByTestId('mobile-services-tab-staff'));
    fireEvent.press(screen.getByTestId('mobile-add-staff'));
    fireEvent.changeText(screen.getByPlaceholderText('Taylor Smith'), 'Morgan');
    fireEvent.changeText(screen.getByPlaceholderText('Stylist'), 'Lead stylist');
    fireEvent.press(screen.getByTestId('mobile-save-staff'));

    await waitFor(() => {
      expect(onCreateStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Morgan',
          role: 'Lead stylist',
        }),
      );
    });
  });
});
