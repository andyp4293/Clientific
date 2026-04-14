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
      onCreateServiceGroup={jest.fn().mockResolvedValue(undefined)}
      onCreateService={jest.fn().mockResolvedValue(undefined)}
      onCreateStaff={jest.fn().mockResolvedValue(undefined)}
      onDeleteServiceGroup={jest.fn().mockResolvedValue(undefined)}
      onDeleteService={jest.fn().mockResolvedValue(undefined)}
      onDeleteStaff={jest.fn().mockResolvedValue(undefined)}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
      onReorderServiceGroups={jest.fn().mockResolvedValue(undefined)}
      onReorderServices={jest.fn().mockResolvedValue(undefined)}
      onUpdateServiceGroup={jest.fn().mockResolvedValue(undefined)}
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

  it('creates a service group from the native form', async () => {
    const onCreateServiceGroup = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onCreateServiceGroup });

    fireEvent.press(screen.getByTestId('mobile-open-group-sheet'));
    fireEvent.changeText(screen.getByPlaceholderText('Manicures'), 'Pedicures');
    fireEvent.press(screen.getByTestId('mobile-save-group'));

    await waitFor(() => {
      expect(onCreateServiceGroup).toHaveBeenCalledWith({ name: 'Pedicures' });
    });
  });

  it('renames a service group from the native form', async () => {
    const onUpdateServiceGroup = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onUpdateServiceGroup });

    fireEvent.press(screen.getByTestId('mobile-group-edit-group-1'));
    fireEvent.changeText(screen.getByDisplayValue('Hair'), 'Hands');
    fireEvent.press(screen.getByTestId('mobile-save-group'));

    await waitFor(() => {
      expect(onUpdateServiceGroup).toHaveBeenCalledWith('group-1', { name: 'Hands' });
    });
  });

  it('reorders service groups with the native controls', async () => {
    const onReorderServiceGroups = jest.fn().mockResolvedValue(undefined);
    const moreGroups: MobileServicesSummary = {
      ...data,
      groups: [
        ...data.groups,
        {
          id: 'group-2',
          name: 'Nails',
          sortOrder: 1,
          servicesCount: 0,
        },
      ],
    };

    renderScreen({ data: moreGroups, onReorderServiceGroups });

    fireEvent.press(screen.getByTestId('mobile-group-down-group-1'));

    await waitFor(() => {
      expect(onReorderServiceGroups).toHaveBeenCalledWith(['group-2', 'group-1']);
    });
  });

  it('reorders services within a group with the native controls', async () => {
    const onReorderServices = jest.fn().mockResolvedValue(undefined);
    const moreServices: MobileServicesSummary = {
      ...data,
      counts: {
        ...data.counts,
        services: 2,
        activeServices: 2,
      },
      groups: [
        {
          id: 'group-1',
          name: 'Hair',
          sortOrder: 0,
          servicesCount: 2,
        },
      ],
      services: [
        ...data.services,
        {
          id: 'svc-2',
          name: 'Blowout',
          description: 'Smooth finish',
          duration: 30,
          durationLabel: '30 min',
          price: 25,
          priceLabel: '$25.00',
          isActive: true,
          groupId: 'group-1',
          groupName: 'Hair',
          sortOrder: 1,
        },
      ],
    };

    renderScreen({ data: moreServices, onReorderServices });

    fireEvent.press(screen.getByTestId('mobile-service-down-svc-1'));

    await waitFor(() => {
      expect(onReorderServices).toHaveBeenCalledWith(['svc-2', 'svc-1']);
    });
  });
});
