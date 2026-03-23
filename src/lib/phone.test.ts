import { describe, expect, it } from 'vitest';
import {
  buildCustomerPhoneData,
  buildCustomerPhoneMatchClauses,
  buildPhoneLookupKey,
  formatPhoneForDisplay,
  normalizeOptionalPhoneNumber,
} from './phone';

describe('phone helpers', () => {
  it('treats +1 and 10-digit US numbers as the same lookup key', () => {
    expect(buildPhoneLookupKey('+18482612613')).toBe('8482612613');
    expect(buildPhoneLookupKey('8482612613')).toBe('8482612613');
    expect(buildPhoneLookupKey('18482612613')).toBe('8482612613');
    expect(buildPhoneLookupKey('(848) 261-2613')).toBe('8482612613');
  });

  it('normalizes optional phone numbers to E.164 when possible', () => {
    expect(normalizeOptionalPhoneNumber('8482612613')).toBe('+18482612613');
    expect(normalizeOptionalPhoneNumber('+18482612613')).toBe('+18482612613');
    expect(normalizeOptionalPhoneNumber('')).toBeNull();
    expect(normalizeOptionalPhoneNumber('123')).toBeNull();
  });

  it('builds match clauses that cover lookup key and raw storage variants', () => {
    expect(buildCustomerPhoneMatchClauses('8482612613')).toEqual(
      expect.arrayContaining([
        { phoneLookupKey: '8482612613' },
        { phone: '+18482612613' },
        { phone: '8482612613' },
      ])
    );
  });

  it('includes the raw 11-digit storage variant when the input already includes country code digits', () => {
    expect(buildCustomerPhoneMatchClauses('18482612613')).toEqual(
      expect.arrayContaining([
        { phoneLookupKey: '8482612613' },
        { phone: '+18482612613' },
        { phone: '18482612613' },
      ])
    );
  });

  it('returns normalized phone data for storage', () => {
    expect(buildCustomerPhoneData('(848) 261-2613')).toEqual({
      phone: '8482612613',
      phoneLookupKey: '8482612613',
    });
  });

  it('formats US numbers for front-desk display', () => {
    expect(formatPhoneForDisplay('+18482612613')).toBe('(848) 261-2613');
    expect(formatPhoneForDisplay('8482612613')).toBe('(848) 261-2613');
  });
});
