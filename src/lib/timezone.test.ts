import { describe, expect, it } from 'vitest';
import {
  businessDayStart,
  localToUTC,
  timezoneFromCoordinates,
  weekdayIndexInTimeZone,
} from './timezone';

describe('timezone utilities', () => {
  it('converts business-local winter and summer times to correct UTC instants', () => {
    const winterNy = localToUTC('2026-01-15', 9, 30, 'America/New_York');
    const summerNy = localToUTC('2026-07-15', 9, 30, 'America/New_York');

    expect(winterNy.toISOString()).toBe('2026-01-15T14:30:00.000Z');
    expect(summerNy.toISOString()).toBe('2026-07-15T13:30:00.000Z');
  });

  it('returns midnight business-day boundary in UTC', () => {
    const laBoundary = businessDayStart('2026-01-15', 'America/Los_Angeles');

    expect(laBoundary.toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });

  it('derives timezone accurately from coordinates', () => {
    expect(timezoneFromCoordinates(37.7749, -122.4194)).toBe('America/Los_Angeles');
    expect(timezoneFromCoordinates(40.7128, -74.006)).toBe('America/New_York');
  });

  it('returns null for invalid coordinates', () => {
    expect(timezoneFromCoordinates(91, -74.006)).toBeNull();
    expect(timezoneFromCoordinates(40.7128, -190)).toBeNull();
  });

  it('derives the weekday in the business timezone for UTC appointment instants', () => {
    const utcInstant = new Date('2026-03-10T00:30:00.000Z');

    expect(weekdayIndexInTimeZone(utcInstant, 'America/New_York')).toBe(1);
    expect(weekdayIndexInTimeZone(utcInstant, 'UTC')).toBe(2);
  });
});
