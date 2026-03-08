import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAffiliateCode } from '@/lib/affiliate';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { name, email, payoutInfo } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return NextResponse.json({ error: 'Name is required (max 100 characters)' }, { status: 400 });
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
  }

  const existing = await prisma.affiliate.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: 'An affiliate account already exists for this email' }, { status: 409 });
  }

  const code = await generateAffiliateCode();

  await prisma.affiliate.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase(),
      code,
      payoutInfo: payoutInfo ? String(payoutInfo).slice(0, 200) : null,
    },
  });

  return NextResponse.json({ code, message: 'Affiliate account created' });
}
