import { describe, expect, it } from 'vitest';
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_TTL_MS,
  canSendVerificationCode,
  createEmailVerificationCode,
  hashVerificationToken,
  isVerificationCode,
  normalizeEmail,
  packVerificationHash,
  parsePackedVerificationHash,
} from './auth-verification';

describe('auth verification helpers', () => {
  it('creates a numeric code with expected ttl and hash', () => {
    const before = Date.now();
    const { token, tokenHash, expiresAt } = createEmailVerificationCode();
    const after = Date.now();

    expect(token).toMatch(new RegExp(`^\\d{${EMAIL_VERIFICATION_CODE_LENGTH}}$`));
    expect(tokenHash).toBe(hashVerificationToken(token));
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + EMAIL_VERIFICATION_TTL_MS);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + EMAIL_VERIFICATION_TTL_MS + 100);
  });

  it('packs and parses verification hash with attempts', () => {
    const packed = packVerificationHash('abc123', 2);
    expect(packed).toBe('abc123:2');
    expect(parsePackedVerificationHash(packed)).toEqual({
      tokenHash: 'abc123',
      failedAttempts: 2,
      isPacked: true,
    });
  });

  it('parses legacy un-packed hashes', () => {
    expect(parsePackedVerificationHash('legacyhash')).toEqual({
      tokenHash: 'legacyhash',
      failedAttempts: 0,
      isPacked: false,
    });
  });

  it('validates verification code format', () => {
    expect(isVerificationCode('123456')).toBe(true);
    expect(isVerificationCode('12345')).toBe(false);
    expect(isVerificationCode('12345a')).toBe(false);
  });

  it('normalizes email by trimming and lower-casing', () => {
    expect(normalizeEmail('  USER@Example.com ')).toBe('user@example.com');
  });

  it('enforces resend cooldown', () => {
    expect(canSendVerificationCode(null)).toBe(true);
    expect(canSendVerificationCode(new Date(Date.now() - EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - 1))).toBe(
      true
    );
    expect(canSendVerificationCode(new Date())).toBe(false);
  });
});
