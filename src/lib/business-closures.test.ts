import { describe, expect, it } from 'vitest';
import {
  describeBusinessClosure,
  findBusinessClosureForDate,
  isValidBusinessClosureDate,
  normalizeBusinessClosureDates,
} from './business-closures';

describe('business closures', () => {
  it('validates strict ISO dates', () => {
    expect(isValidBusinessClosureDate('2026-12-25')).toBe(true);
    expect(isValidBusinessClosureDate('2026-02-30')).toBe(false);
    expect(isValidBusinessClosureDate('12/25/2026')).toBe(false);
  });

  it('normalizes, deduplicates, and sorts closure dates', () => {
    expect(
      normalizeBusinessClosureDates([
        { date: '2026-12-25', label: '  Christmas   Day ' },
        { date: '2026-07-04', label: 'Independence Day' },
        { date: '2026-12-25', label: 'Christmas' },
        { date: 'bad-date', label: 'Ignore me' },
      ])
    ).toEqual([
      { date: '2026-07-04', label: 'Independence Day' },
      { date: '2026-12-25', label: 'Christmas' },
    ]);
  });

  it('finds a closure for a matching date and formats the message', () => {
    const closure = findBusinessClosureForDate('2026-12-25', [
      { date: '2026-12-25', label: 'Christmas Day' },
    ]);

    expect(closure).toEqual({ date: '2026-12-25', label: 'Christmas Day' });
    expect(describeBusinessClosure(closure)).toBe('Business is closed for Christmas Day.');
    expect(describeBusinessClosure({ date: '2026-12-31', label: null })).toBe(
      'Business is closed on this date.'
    );
  });
});
