import { prisma } from './prisma';

// Characters chosen to avoid visual ambiguity (no I, O, 1, 0)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a unique 8-character referral code for a business.
 * Retries until a code that doesn't already exist in the DB is found.
 */
export async function generateReferralCode(): Promise<string> {
  let code: string;
  do {
    code = Array.from(
      { length: 8 },
      () => CHARS[Math.floor(Math.random() * CHARS.length)]
    ).join('');
  } while (await prisma.business.findUnique({ where: { referralCode: code } }));
  return code;
}
