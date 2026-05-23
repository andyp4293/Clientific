import { describe, expect, it } from 'vitest';
import {
  sanitizeUserTextFieldsForStorage,
  sanitizeUserTextForStorage,
} from './user-text-sanitization';

describe('user text sanitization', () => {
  it('preserves valid emoji, Vietnamese accents, and normal punctuation', () => {
    const value = 'Tiếng Việt nails 💅🏽✨ — khách VIP';

    expect(sanitizeUserTextForStorage(value)).toBe(value);
  });

  it('normalizes decomposed accents before storage', () => {
    expect(sanitizeUserTextForStorage('Cafe\u0301')).toBe('Café');
  });

  it('removes NUL bytes and invisible control characters while preserving readable whitespace', () => {
    const value = 'Line 1\u0000\u0007\nLine 2\tOK\rDone';

    expect(sanitizeUserTextForStorage(value)).toBe('Line 1\nLine 2\tOK\rDone');
  });

  it('repairs malformed surrogate pairs instead of letting invalid Unicode reach the database', () => {
    expect(sanitizeUserTextForStorage('Broken \uD83D text')).toBe('Broken \uFFFD text');
    expect(sanitizeUserTextForStorage('Broken \uDC85 text')).toBe('Broken \uFFFD text');
  });

  it('truncates by code point so emoji are not split into invalid UTF-16', () => {
    expect(sanitizeUserTextForStorage('A💅B', { maxLength: 2 })).toBe('A💅');
  });

  it('recursively sanitizes user-facing Prisma data fields only', () => {
    const sanitized = sanitizeUserTextFieldsForStorage({
      id: 'cust_\u0000do-not-change',
      passwordHash: 'hash_\u0000do-not-change',
      name: 'Ana\u0000 💅',
      notes: 'Prefers quiet room \u0001',
      groupMemberships: {
        create: [
          {
            groupId: 'group_\u0000do-not-change',
            group: {
              create: {
                name: 'VIP\u0000 clients',
              },
            },
          },
        ],
      },
    });

    expect(sanitized).toEqual({
      id: 'cust_\u0000do-not-change',
      passwordHash: 'hash_\u0000do-not-change',
      name: 'Ana 💅',
      notes: 'Prefers quiet room ',
      groupMemberships: {
        create: [
          {
            groupId: 'group_\u0000do-not-change',
            group: {
              create: {
                name: 'VIP clients',
              },
            },
          },
        ],
      },
    });
  });

  it('caps user-facing fields at their safest storage size', () => {
    const sanitized = sanitizeUserTextFieldsForStorage({
      name: 'a'.repeat(300),
      notes: 'b'.repeat(4_500),
    });

    expect(sanitized.name).toHaveLength(240);
    expect(sanitized.notes).toHaveLength(4_000);
  });

  it('also sanitizes nested Prisma string filters for text fields', () => {
    const sanitized = sanitizeUserTextFieldsForStorage({
      where: {
        name: {
          contains: 'Ana\u0000',
          mode: 'insensitive',
        },
        id: {
          contains: 'cust_\u0000not-user-text',
        },
      },
    });

    expect(sanitized).toEqual({
      where: {
        name: {
          contains: 'Ana',
          mode: 'insensitive',
        },
        id: {
          contains: 'cust_\u0000not-user-text',
        },
      },
    });
  });

  it('does not treat SQL-looking text as executable input', () => {
    const value = "Robert'); DROP TABLE Customer; -- 💣";

    expect(sanitizeUserTextForStorage(value)).toBe(value);
  });
});
