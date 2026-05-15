import React from 'react';
import { Keyboard } from 'react-native';
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
      bio: 'Known for detailed gel manicures and calm consultations.',
      isActive: true,
      portalAccessEnabled: true,
      hasPortalPassword: true,
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
    expect(screen.getByText('Known for detailed gel manicures and calm consultations.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-add-staff'));
    fireEvent.changeText(screen.getByPlaceholderText('Taylor Smith'), 'Morgan');
    fireEvent.changeText(screen.getByPlaceholderText('Stylist'), 'Lead stylist');
    fireEvent.changeText(
      screen.getByPlaceholderText('Example: Senior stylist specializing in gel manicures and natural nail care.'),
      'Friendly specialist for natural nails.',
    );
    fireEvent.press(screen.getByTestId('mobile-save-staff'));

    await waitFor(() => {
      expect(onCreateStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Morgan',
          role: 'Lead stylist',
          bio: 'Friendly specialist for natural nails.',
        }),
      );
    });
  });

  it('shows staff hours as AM/PM and saves normalized 24-hour values', async () => {
    const onUpdateStaff = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onUpdateStaff });

    fireEvent.press(screen.getByTestId('mobile-services-tab-staff'));
    fireEvent.press(screen.getByTestId('mobile-staff-edit-staff-1'));

    expect(screen.getByDisplayValue('9:00 AM')).toBeTruthy();
    expect(screen.getByDisplayValue('5:00 PM')).toBeTruthy();

    fireEvent.changeText(screen.getAllByDisplayValue('9:00 AM')[0], '9:30 AM');
    fireEvent.changeText(screen.getAllByDisplayValue('5:00 PM')[0], '6:15 PM');
    fireEvent.press(screen.getByTestId('mobile-save-staff'));

    await waitFor(() => {
      expect(onUpdateStaff).toHaveBeenCalledWith(
        'staff-1',
        expect.objectContaining({
          workHours: expect.objectContaining({
            1: { startTime: '09:30', endTime: '18:15' },
          }),
        }),
      );
    });
  });

  it('keeps staff delete in the edit form danger zone and dismisses the keyboard before showing save errors', async () => {
    const keyboardDismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const onUpdateStaff = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onUpdateStaff });

    fireEvent.press(screen.getByTestId('mobile-services-tab-staff'));
    fireEvent.press(screen.getByTestId('mobile-staff-edit-staff-1'));

    expect(screen.getByTestId('mobile-delete-staff-from-sheet')).toBeTruthy();
    expect(screen.getByText('Delete staff member')).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue('Taylor'), '');
    fireEvent.press(screen.getByTestId('mobile-save-staff'));

    expect(keyboardDismissSpy).toHaveBeenCalled();
    expect(screen.getByText('Fix before saving')).toBeTruthy();
    expect(screen.getAllByText('Staff name is required.')).toHaveLength(2);
    expect(onUpdateStaff).not.toHaveBeenCalled();

    keyboardDismissSpy.mockRestore();
  });

  it('saves employee app access so the backend emails a temporary password', async () => {
    const onCreateStaff = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onCreateStaff });

    fireEvent.press(screen.getByTestId('mobile-services-tab-staff'));
    expect(screen.getByText('Employee app enabled')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-add-staff'));
    fireEvent.changeText(screen.getByPlaceholderText('Taylor Smith'), 'Morgan');
    fireEvent.changeText(screen.getByPlaceholderText('taylor@example.com'), 'morgan@example.com');
    fireEvent(screen.getByTestId('mobile-staff-portal-toggle'), 'valueChange', true);
    expect(screen.getByText('Temporary password email')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-save-staff'));

    await waitFor(() => {
      expect(onCreateStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Morgan',
          email: 'morgan@example.com',
          portalAccessEnabled: true,
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

  it('closes the full-screen group sheet from the header close button', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('mobile-open-group-sheet'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Manicures')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mobile-services-sheet-close'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Manicures')).toBeNull();
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
