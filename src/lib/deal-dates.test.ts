import { describe, expect, it } from 'vitest';
import {
  addDays,
  fromDateOnlyValue,
  isDealEndSameOrBeforeStart,
  isDealStartBeforeToday,
  toDateOnlyValue,
} from './deal-dates';

describe('deal date helpers', () => {
  it('formats and parses date-only values consistently', () => {
    const value = toDateOnlyValue(new Date(2026, 2, 15));
    expect(value).toBe('2026-03-15');

    const parsed = fromDateOnlyValue(value);
    expect(parsed).not.toBeNull();
    expect(toDateOnlyValue(parsed!)).toBe('2026-03-15');
  });

  it('detects a start date earlier than today', () => {
    const now = new Date(2026, 2, 15, 10, 30);
    expect(isDealStartBeforeToday('2026-03-14', now)).toBe(true);
    expect(isDealStartBeforeToday('2026-03-15', now)).toBe(false);
  });

  it('treats the same-day end date as invalid', () => {
    expect(isDealEndSameOrBeforeStart('2026-03-15', '2026-03-15')).toBe(true);
    expect(isDealEndSameOrBeforeStart('2026-03-15', '2026-03-16')).toBe(false);
  });

  it('adds whole calendar days without carrying over the time', () => {
    const nextDay = addDays(new Date(2026, 2, 15, 18, 45), 1);
    expect(toDateOnlyValue(nextDay)).toBe('2026-03-16');
    expect(nextDay.getHours()).toBe(0);
    expect(nextDay.getMinutes()).toBe(0);
  });
});
