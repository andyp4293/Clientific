import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createEmailVerificationToken, isValidEmail } from '@/lib/auth-verification';
import { sendEmailVerificationEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !isValidEmail(email) || email.length > 254) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();
    const business = await prisma.business.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    // Return generic success to avoid account enumeration.
    if (!business || business.emailVerifiedAt) {
      return NextResponse.json({ success: true });
    }

    const { token, tokenHash, expiresAt } = createEmailVerificationToken();
    await prisma.business.update({
      where: { id: business.id },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationTokenExpiry: expiresAt,
        verificationSentAt: new Date(),
      },
    });

    await sendEmailVerificationEmail(business.email, token);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Verify email send error:', error);
    return NextResponse.json(
      { error: 'Unable to send verification email right now. Please try again.' },
      { status: 500 }
    );
  }
}
