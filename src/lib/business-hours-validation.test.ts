import { describe, expect, it } from 'vitest';
import { validateBusinessHoursForAppointment } from './business-hours-validation';

describe('business hours validation', () => {
  it('blocks a specific closure date before weekly hours are considered', () => {
    const result = validateBusinessHoursForAppointment({
      startTime: new Date('2026-12-25T15:00:00.000Z'),
      endTime: new Date('2026-12-25T16:00:00.000Z'),
      timezone: 'America/New_York',
      businessHours: {
        5: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
      closureDates: [{ date: '2026-12-25', label: 'Christmas Day' }],
    });

    expect(result).toEqual({
      error: 'Business is closed for Christmas Day.',
      status: 400,
      reason: 'business_closed',
    });
  });

  it('blocks times outside the weekly business window', () => {
    const result = validateBusinessHoursForAppointment({
      startTime: new Date('2026-03-10T22:00:00.000Z'),
      endTime: new Date('2026-03-10T23:00:00.000Z'),
      timezone: 'America/New_York',
      businessHours: {
        2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      },
      closureDates: [],
    });

    expect(result?.error).toContain('This business is open Tuesday from 9:00 AM to 5:00 PM.');
  });
});
