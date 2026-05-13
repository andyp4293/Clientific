import { describe, expect, it } from 'vitest';

import {
  buildAppointmentBookedNotificationMessage,
  buildAppointmentRescheduledNotificationMessage,
  buildAppointmentScheduledNotificationMessage,
  formatAppointmentNotificationTime,
} from '@/lib/appointment-notification-copy';

describe('appointment notification copy', () => {
  it('formats the appointment time in the business timezone', () => {
    expect(
      formatAppointmentNotificationTime(
        new Date('2026-05-13T19:30:00.000Z'),
        'America/New_York',
      ),
    ).toBe('Wed, May 13, 3:30 PM');
  });

  it('builds a detailed booking notification with customer, service, staff, and time', () => {
    expect(
      buildAppointmentBookedNotificationMessage({
        customerName: 'Khang Nguyen',
        serviceName: 'Gel Manicure',
        staffName: 'Andy',
        startTime: new Date('2026-05-13T19:30:00.000Z'),
        timezone: 'America/New_York',
      }),
    ).toBe('Khang Nguyen booked Gel Manicure with Andy for Wed, May 13, 3:30 PM.');
  });

  it('omits the staff phrase when the appointment is with anyone available', () => {
    expect(
      buildAppointmentBookedNotificationMessage({
        customerName: 'Khang Nguyen',
        serviceName: 'Gel Manicure',
        staffName: null,
        startTime: new Date('2026-05-13T19:30:00.000Z'),
        timezone: 'America/New_York',
      }),
    ).toBe('Khang Nguyen booked Gel Manicure for Wed, May 13, 3:30 PM.');
  });

  it('builds a detailed manual scheduling notification', () => {
    expect(
      buildAppointmentScheduledNotificationMessage({
        customerName: 'Khang Nguyen',
        serviceName: 'Pedicure',
        staffName: 'Andy',
        startTime: new Date('2026-05-13T19:30:00.000Z'),
        timezone: 'America/New_York',
      }),
    ).toBe('Khang Nguyen was scheduled for Pedicure with Andy at Wed, May 13, 3:30 PM.');
  });

  it('builds a detailed reschedule notification', () => {
    expect(
      buildAppointmentRescheduledNotificationMessage({
        customerName: 'Khang Nguyen',
        serviceName: 'Pedicure',
        staffName: 'Andy',
        startTime: new Date('2026-05-13T19:30:00.000Z'),
        timezone: 'America/New_York',
      }),
    ).toBe('Khang Nguyen requested to move Pedicure with Andy to Wed, May 13, 3:30 PM.');
  });
});
