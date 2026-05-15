import { describe, expect, it } from 'vitest';
import {
  hasCustomerVisibleAppointmentChanges,
  isCustomerBookedAppointmentSource,
} from './appointment-update-sms';

const appointment = {
  source: 'online',
  startTime: new Date('2026-04-10T18:00:00.000Z'),
  duration: 45,
  serviceId: 'svc-1',
  serviceIds: ['svc-1'],
  staffId: 'staff-1',
};

describe('appointment update SMS helpers', () => {
  it('treats online, AI, and SMS AI bookings as customer-booked sources', () => {
    expect(isCustomerBookedAppointmentSource('online')).toBe(true);
    expect(isCustomerBookedAppointmentSource('ai')).toBe(true);
    expect(isCustomerBookedAppointmentSource('sms_ai')).toBe(true);
    expect(isCustomerBookedAppointmentSource('dashboard')).toBe(false);
  });

  it('detects customer-visible service, staff, duration, and time changes', () => {
    expect(
      hasCustomerVisibleAppointmentChanges(appointment, {
        startTime: '2026-04-10T19:00:00.000Z',
      }),
    ).toBe(true);
    expect(hasCustomerVisibleAppointmentChanges(appointment, { duration: 60 })).toBe(true);
    expect(hasCustomerVisibleAppointmentChanges(appointment, { serviceId: 'svc-2' })).toBe(true);
    expect(
      hasCustomerVisibleAppointmentChanges(appointment, { serviceIds: ['svc-2'] }),
    ).toBe(true);
    expect(hasCustomerVisibleAppointmentChanges(appointment, { staffId: 'staff-2' })).toBe(true);
  });

  it('ignores notes-only and same-value appointment edits', () => {
    expect(
      hasCustomerVisibleAppointmentChanges(appointment, {
        startTime: '2026-04-10T18:00:00.000Z',
        duration: 45,
        serviceId: 'svc-1',
        serviceIds: ['svc-1'],
        staffId: 'staff-1',
      }),
    ).toBe(false);
    expect(hasCustomerVisibleAppointmentChanges(appointment, {})).toBe(false);
  });
});
