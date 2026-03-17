import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { isValidEmail } from '@/lib/auth-verification';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !isValidEmail(email) || email.length > 254) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();

    const business = await prisma.business.findUnique({
      where: { email: normalizedEmail },
    });

    // Always return success to avoid leaking whether an email exists
    if (!business) {
      return NextResponse.json({ success: true });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.business.update({
      where: { id: business.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    try {
      await sendPasswordResetEmail(business.email, token);
    } catch (emailError: any) {
      // Log the failure but don't surface it — token is stored, user can retry
      console.error('Password reset email send failed:', emailError?.message ?? emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to send reset email. Please try again.' },
      { status: 500 }
    );
  }
}
