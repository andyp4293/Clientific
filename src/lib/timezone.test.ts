import { describe, expect, it } from 'vitest';
import { businessDayStart, localToUTC } from './timezone';

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
});
