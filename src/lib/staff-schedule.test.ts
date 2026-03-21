import { describe, expect, it } from 'vitest';

import {
  buildAppointmentStartOptions,
  formatStaffAvailabilitySummary,
  getEffectiveStaffDayHours,
  isAppointmentWithinStaffHours,
  normalizeBusinessHoursRecord,
  normalizeStaffWorkHours,
} from './staff-schedule';

describe('staff schedule helpers', () => {
  it('normalizes business hours and fills the default shape', () => {
    const record = normalizeBusinessHoursRecord({
      2: { isOpen: true, openTime: '10:00', closeTime: '18:00' },
    });

    expect(record[2]).toEqual({
      isOpen: true,
      openTime: '10:00',
      closeTime: '18:00',
    });
    expect(record[0]).toEqual({
      isOpen: false,
      openTime: null,
      closeTime: null,
    });
  });

  it('keeps only valid custom staff-hour entries', () => {
    expect(
      normalizeStaffWorkHours({
        1: { startTime: '10:00', endTime: '16:00' },
        2: { startTime: '18:00', endTime: '12:00' },
        8: { startTime: '09:00', endTime: '17:00' },
      })
    ).toEqual({
      1: { startTime: '10:00', endTime: '16:00' },
    });
  });

  it('falls back to business hours when no custom staff hours are saved', () => {
    expect(
      getEffectiveStaffDayHours({
        dayOfWeek: 1,
        workDays: [1, 2, 3],
        businessHours: {
          1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        },
      })
    ).toEqual({
      worksDay: true,
      startTime: '09:00',
      endTime: '17:00',
      source: 'business',
    });
  });

  it('clamps custom staff hours to the business window', () => {
    expect(
      getEffectiveStaffDayHours({
        dayOfWeek: 1,
        workDays: [1],
        workHours: {
          1: { startTime: '08:00', endTime: '19:00' },
        },
        businessHours: {
          1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        },
      })
    ).toEqual({
      worksDay: true,
      startTime: '09:00',
      endTime: '17:00',
      source: 'custom',
    });
  });

  it('generates appointment start times that fit inside the schedule window', () => {
    expect(buildAppointmentStartOptions('10:00', '15:00', 90)).toEqual([
      '10:00',
      '10:30',
      '11:00',
      '11:30',
      '12:00',
      '12:30',
      '13:00',
      '13:30',
    ]);
  });

  it('checks appointment ranges against a custom staff schedule', () => {
    const result = isAppointmentWithinStaffHours({
      startTime: new Date('2026-03-10T18:00:00.000Z'),
      endTime: new Date('2026-03-10T19:00:00.000Z'),
      timezone: 'America/New_York',
      workDays: [2],
      workHours: {
        2: { startTime: '10:00', endTime: '13:00' },
      },
      businessHours: {
        2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
    });

    expect(result).toMatchObject({
      allowed: false,
      dayOfWeek: 2,
      startLabel: '10:00',
      endLabel: '13:00',
    });
  });

  it('formats a readable weekly summary for staff availability', () => {
    expect(
      formatStaffAvailabilitySummary({
        workDays: [1, 2],
        workHours: {
          1: { startTime: '10:00', endTime: '16:00' },
        },
        businessHours: {
          1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        },
        weekdayLabels: ['Sun', 'Mon', 'Tue'],
      })
    ).toContain('Mon 10:00 AM-4:00 PM');
  });
});
