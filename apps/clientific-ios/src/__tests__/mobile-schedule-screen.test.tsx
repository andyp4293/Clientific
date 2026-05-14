import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MobileScheduleScreen } from '@/components/mobile-schedule-screen';

const business = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  onboardingComplete: true,
};

const servicesSummary = {
  business,
  counts: {
    services: 1,
    activeServices: 1,
    staff: 1,
    activeStaff: 1,
  },
  groups: [],
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
      groupId: null,
      groupName: null,
      sortOrder: 0,
    },
  ],
  staff: [
    {
      id: 'staff-1',
      fullName: 'Taylor',
      email: 'taylor@example.com',
      phone: '+15551234567',
      phoneDisplay: '(555) 123-4567',
      role: 'Stylist',
      bio: 'Gentle with first-time clients and excellent at clean gel sets.',
      isActive: true,
      portalAccessEnabled: true,
      hasPortalPassword: true,
      workDays: [1, 2, 3],
      workHours: {
        1: { startTime: '09:00', endTime: '17:00' },
        2: { startTime: '09:00', endTime: '17:00' },
        3: { startTime: '09:00', endTime: '17:00' },
      },
      workDaysLabel: 'Mon, Tue, Wed',
      workHoursLabel: 'Mon 09:00-17:00',
      serviceCount: 0,
      serviceIds: [],
      serviceNames: [],
    },
  ],
};

const composerCustomers = [
  {
    id: 'cust-1',
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    phone: '+15551234567',
    phoneDisplay: '(555) 123-4567',
    joinedLabel: 'Mar 18, 2026',
    lastVisitLabel: 'Mar 29, 2026',
    totalSpentLabel: '$120.00',
    segment: 'VIP',
    segmentLabel: 'VIP',
    smsConsent: true,
    smsOptedOut: false,
    dealSmsBlocked: false,
    visitsCount: 3,
    groups: [],
  },
];

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
        customerId: 'cust-1',
        customerName: 'Jordan Lee',
        serviceId: 'svc-1',
        serviceName: 'Haircut',
        staffId: 'staff-1',
        staffName: 'Taylor',
        status: 'pending',
        statusLabel: 'Pending',
        startTime: '2026-03-31T15:30:00.000Z',
        startTimeLabel: '11:30 AM',
        endTimeLabel: '12:15 PM',
        duration: 45,
        source: 'dashboard',
        sourceLabel: 'Manual',
        notes: null,
        canConfirm: true,
        canModify: true,
      },
    ],
  };
}

function renderScreen(
  overrides: Partial<React.ComponentProps<typeof MobileScheduleScreen>> = {},
) {
  return render(
    <MobileScheduleScreen
      composerCustomers={composerCustomers}
      composerError={null}
      data={buildSchedule('2099-03-31', 'Thursday, March 31')}
      error={null}
      isComposerLoading={false}
      isLoading={false}
      isRefreshing={false}
      servicesSummary={servicesSummary}
      onCreateAppointment={jest.fn().mockResolvedValue(undefined)}
      onCreateAppointmentCustomer={jest.fn().mockResolvedValue(composerCustomers[0])}
      onDeleteAppointment={jest.fn().mockResolvedValue(undefined)}
      onJumpToToday={jest.fn()}
      onLoadComposerResources={jest.fn().mockResolvedValue(undefined)}
      onNextDate={jest.fn()}
      onSelectDate={jest.fn()}
      onPreviousDate={jest.fn()}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
      onSignOut={jest.fn().mockResolvedValue(undefined)}
      onUpdateAppointment={jest.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );
}

describe('MobileScheduleScreen', () => {
  it('marks the Today button as selected only when viewing today', () => {
    const todayKey = new Date().toLocaleDateString('en-CA');
    const { rerender } = renderScreen({
      data: buildSchedule(todayKey),
    });

    expect(screen.getByTestId('mobile-schedule-today').props.accessibilityState).toMatchObject({
      selected: true,
    });

    rerender(
      <MobileScheduleScreen
        composerCustomers={composerCustomers}
        composerError={null}
        data={buildSchedule('2099-03-31', 'Thursday, March 31')}
        error={null}
        isComposerLoading={false}
        isLoading={false}
        isRefreshing={false}
        servicesSummary={servicesSummary}
        onCreateAppointment={jest.fn().mockResolvedValue(undefined)}
        onCreateAppointmentCustomer={jest.fn().mockResolvedValue(composerCustomers[0])}
        onDeleteAppointment={jest.fn().mockResolvedValue(undefined)}
        onJumpToToday={jest.fn()}
        onLoadComposerResources={jest.fn().mockResolvedValue(undefined)}
        onNextDate={jest.fn()}
        onSelectDate={jest.fn()}
        onPreviousDate={jest.fn()}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onSignOut={jest.fn().mockResolvedValue(undefined)}
        onUpdateAppointment={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('mobile-schedule-today').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('renders staff mode as appointment-only and hides owner actions', () => {
    renderScreen({
      accessMode: 'staff',
      staffViewerName: 'Taylor',
      data: {
        ...buildSchedule('2099-03-31', 'Thursday, March 31'),
        viewer: {
          role: 'staff',
          staffId: 'staff-1',
          staffName: 'Taylor',
          privacy: 'customer_phone_hidden',
        },
        appointments: [
          {
            ...buildSchedule('2099-03-31').appointments[0],
            canConfirm: false,
            canModify: false,
          },
        ],
      },
    });

    expect(screen.getByText('Employee schedule')).toBeTruthy();
    expect(screen.getByTestId('mobile-staff-privacy-card')).toBeTruthy();
    expect(screen.queryByTestId('mobile-schedule-add')).toBeNull();
    expect(screen.queryByTestId('mobile-appointment-confirm-appt-1')).toBeNull();
    expect(screen.queryByTestId('mobile-appointment-edit-appt-1')).toBeNull();
    expect(screen.queryByTestId('mobile-appointment-cancel-appt-1')).toBeNull();
    expect(screen.getByText(/Phone numbers and customer records are hidden/i)).toBeTruthy();
  });

  it('still lets the user jump back to today', () => {
    const onJumpToToday = jest.fn();

    renderScreen({ onJumpToToday });

    fireEvent.press(screen.getByTestId('mobile-schedule-today'));

    expect(onJumpToToday).toHaveBeenCalledTimes(1);
  });

  it('opens the schedule calendar, supports month navigation, and lets the user pick another day', () => {
    const onSelectDate = jest.fn();

    renderScreen({ onSelectDate });

    fireEvent.press(screen.getByTestId('mobile-schedule-open-calendar'));
    expect(screen.getByTestId('mobile-calendar-next-month')).toBeTruthy();
    expect(screen.getByTestId('mobile-calendar-previous-month')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-calendar-next-month'));
    fireEvent.press(screen.getByTestId('mobile-calendar-day-2099-04-01'));

    expect(onSelectDate).toHaveBeenCalledWith('2099-04-01');
  });

  it('opens the create sheet, loads composer resources, and submits a new appointment', async () => {
    const onLoadComposerResources = jest.fn().mockResolvedValue(undefined);
    const onCreateAppointment = jest.fn().mockResolvedValue(undefined);

    renderScreen({
      onCreateAppointment,
      onLoadComposerResources,
    });

    fireEvent.press(screen.getByTestId('mobile-schedule-add'));

    await waitFor(() => {
      expect(onLoadComposerResources).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('mobile-schedule-create-submit')).toBeTruthy();
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('mobile-existing-customer-cust-1').props.accessibilityState,
      ).toMatchObject({ selected: true });
    });
    await waitFor(() => {
      expect(
        screen.getByTestId('mobile-schedule-appointment-sms-toggle').props.accessibilityState,
      ).toMatchObject({ checked: true });
    });
    fireEvent.press(screen.getByTestId('mobile-schedule-create-service-svc-1'));
    expect(screen.getByText('Gentle with first-time clients and excellent at clean gel sets.')).toBeTruthy();
    expect(screen.getByText('Mon, Tue, Wed · All services')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-schedule-create-staff-staff-1'));
    fireEvent.press(screen.getByTestId('mobile-schedule-create-time-10:30'));
    fireEvent.press(screen.getByTestId('mobile-schedule-create-submit'));

    await waitFor(() => {
      expect(onCreateAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-1',
          serviceId: 'svc-1',
          staffId: 'staff-1',
          duration: 45,
          appointmentSmsConsent: true,
        }),
      );
    });
  });

  it('uses service-first appointment creation instead of manual duration when services exist', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('mobile-schedule-add'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-schedule-create-service-svc-1')).toBeTruthy();
    });

    expect(screen.queryByText('Manual booking')).toBeNull();
    expect(screen.queryByText('Manual duration')).toBeNull();
    expect(
      screen.getByTestId('mobile-schedule-create-service-svc-1').props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByText('Available slots are based on Haircut (45 min).')).toBeTruthy();
  });

  it('does not expose manual duration when no active services are configured', async () => {
    renderScreen({
      servicesSummary: {
        ...servicesSummary,
        counts: {
          ...servicesSummary.counts,
          services: 0,
          activeServices: 0,
        },
        services: [],
      },
    });

    fireEvent.press(screen.getByTestId('mobile-schedule-add'));

    await waitFor(() => {
      expect(screen.getByText('Add a service first')).toBeTruthy();
    });

    expect(screen.queryByText('Manual booking')).toBeNull();
    expect(screen.queryByText('Manual duration')).toBeNull();
    expect(screen.queryByText('Temporary duration')).toBeNull();
    expect(
      screen.getByTestId('mobile-schedule-create-submit').props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('opens the create overlay calendar and applies the selected date', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('mobile-schedule-add'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-schedule-create-open-calendar')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mobile-schedule-create-open-calendar'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-calendar-close')).toBeTruthy();
    });
    expect(screen.getByTestId('mobile-schedule-create-submit')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-calendar-next-month'));
    fireEvent.press(screen.getByTestId('mobile-calendar-day-2099-04-01'));

    await waitFor(() => {
      expect(screen.getByText('Wednesday, April 1')).toBeTruthy();
    });
  });

  it('closes the create appointment sheet from the header close button', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('mobile-schedule-add'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-schedule-create-submit')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('mobile-schedule-sheet-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('mobile-schedule-create-submit')).toBeNull();
    });
  });

  it('uses a real checkbox state for appointment text consent in the create sheet', async () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('mobile-schedule-add'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-schedule-appointment-sms-toggle')).toBeTruthy();
    });

    expect(
      screen.getByTestId('mobile-schedule-appointment-sms-toggle').props.accessibilityState,
    ).toMatchObject({ checked: true });

    fireEvent.press(screen.getByTestId('mobile-schedule-appointment-sms-toggle'));

    expect(
      screen.getByTestId('mobile-schedule-appointment-sms-toggle').props.accessibilityState,
    ).toMatchObject({ checked: false });
  });

  it('confirms a pending appointment from the list', async () => {
    const onUpdateAppointment = jest.fn().mockResolvedValue(undefined);

    renderScreen({ onUpdateAppointment });

    fireEvent.press(screen.getByTestId('mobile-appointment-confirm-appt-1'));

    await waitFor(() => {
      expect(onUpdateAppointment).toHaveBeenCalledWith('appt-1', { status: 'confirmed' });
    });
  });

  it('opens the edit sheet and saves updated appointment timing', async () => {
    const onUpdateAppointment = jest.fn().mockResolvedValue(undefined);

    renderScreen({ onUpdateAppointment });

    fireEvent.press(screen.getByTestId('mobile-appointment-edit-appt-1'));
    fireEvent.press(screen.getByTestId('mobile-schedule-edit-open-calendar'));
    expect(screen.getByTestId('mobile-schedule-edit-submit')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-calendar-day-2026-04-01'));
    fireEvent.press(screen.getByTestId('mobile-schedule-edit-time-12:00'));
    fireEvent.press(screen.getByTestId('mobile-schedule-edit-submit'));

    const expectedStartTime = new Date('2026-04-01T12:00').toISOString();

    await waitFor(() => {
      expect(onUpdateAppointment).toHaveBeenCalledWith(
        'appt-1',
        expect.objectContaining({
          duration: 45,
          startTime: expectedStartTime,
        }),
      );
    });
  });
});
