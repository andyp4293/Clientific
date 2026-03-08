import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashVerificationToken } from '@/lib/auth-verification';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string' || token.length < 20) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
    }

    const tokenHash = hashVerificationToken(token);
    const business = await prisma.business.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationTokenExpiry: { gt: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'This verification link is invalid or expired.' }, { status: 400 });
    }

    await prisma.business.update({
      where: { id: business.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiry: null,
      },
    });

    return NextResponse.json({ success: true, email: business.email });
  } catch (error: any) {
    console.error('Verify email confirm error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email. Please try again.' },
      { status: 500 }
    );
  }
}
