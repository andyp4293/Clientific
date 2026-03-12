import crypto from 'crypto';

export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
export const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000;
export const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export function hashVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createEmailVerificationCode() {
  const token = crypto
    .randomInt(0, 10 ** EMAIL_VERIFICATION_CODE_LENGTH)
    .toString()
    .padStart(EMAIL_VERIFICATION_CODE_LENGTH, '0');
  const tokenHash = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  return { token, tokenHash, expiresAt };
}

export function packVerificationHash(tokenHash: string, failedAttempts: number = 0): string {
  const safeAttempts = Number.isFinite(failedAttempts)
    ? Math.max(0, Math.floor(failedAttempts))
    : 0;
  return `${tokenHash}:${safeAttempts}`;
}

export function parsePackedVerificationHash(
  value: string | null | undefined
): { tokenHash: string | null; failedAttempts: number; isPacked: boolean } {
  if (!value) {
    return { tokenHash: null, failedAttempts: 0, isPacked: false };
  }

  const [tokenHash, attemptsRaw] = value.split(':', 2);
  if (!attemptsRaw) {
    return { tokenHash: value, failedAttempts: 0, isPacked: false };
  }

  const parsedAttempts = Number.parseInt(attemptsRaw, 10);
  return {
    tokenHash,
    failedAttempts: Number.isFinite(parsedAttempts) ? Math.max(0, parsedAttempts) : 0,
    isPacked: true,
  };
}

export function isVerificationCode(input: string): boolean {
  return new RegExp(`^\\d{${EMAIL_VERIFICATION_CODE_LENGTH}}$`).test(input);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function canSendVerificationCode(verificationSentAt: Date | null | undefined): boolean {
  if (!verificationSentAt) {
    return true;
  }
  return Date.now() - verificationSentAt.getTime() >= EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
