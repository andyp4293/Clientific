import { prisma } from '@/lib/prisma';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function generateAffiliateCode(): Promise<string> {
  let code: string;
  do {
    code = Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
  } while (await prisma.affiliate.findUnique({ where: { code } }));
  return code;
}
