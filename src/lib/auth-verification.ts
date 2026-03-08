import crypto from 'crypto';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export function hashVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  return { token, tokenHash, expiresAt };
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
