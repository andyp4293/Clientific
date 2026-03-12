import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
  hashVerificationToken,
  isValidEmail,
  isVerificationCode,
  normalizeEmail,
  packVerificationHash,
  parsePackedVerificationHash,
} from '@/lib/auth-verification';

const INVALID_CODE_MESSAGE = 'Verification code is invalid or expired.';
const TOO_MANY_ATTEMPTS_MESSAGE =
  'Too many incorrect attempts. Request a new verification code.';

async function confirmLegacyLinkToken(token: string) {
  if (token.length < 20) {
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
    return NextResponse.json(
      { error: 'This verification link is invalid or expired.' },
      { status: 400 }
    );
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
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (token) {
      return confirmLegacyLinkToken(token);
    }

    const rawEmail = typeof body?.email === 'string' ? body.email : '';
    const rawCode = typeof body?.code === 'string' ? body.code.trim() : '';
    const email = normalizeEmail(rawEmail);

    if (!email || !isValidEmail(email) || !isVerificationCode(rawCode)) {
      return NextResponse.json({ error: 'Email and 6-digit code are required.' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        emailVerificationTokenHash: true,
        emailVerificationTokenExpiry: true,
      },
    });

    if (!business || business.emailVerifiedAt) {
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    if (
      !business.emailVerificationTokenHash ||
      !business.emailVerificationTokenExpiry ||
      business.emailVerificationTokenExpiry <= new Date()
    ) {
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    const parsed = parsePackedVerificationHash(business.emailVerificationTokenHash);
    if (!parsed.tokenHash) {
      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
    }

    if (parsed.isPacked && parsed.failedAttempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      await prisma.business.update({
        where: { id: business.id },
        data: {
          emailVerificationTokenHash: null,
          emailVerificationTokenExpiry: null,
        },
      });
      return NextResponse.json({ error: TOO_MANY_ATTEMPTS_MESSAGE }, { status: 400 });
    }

    const submittedHash = hashVerificationToken(rawCode);
    if (submittedHash !== parsed.tokenHash) {
      if (parsed.isPacked) {
        const nextAttemptCount = parsed.failedAttempts + 1;
        if (nextAttemptCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
          await prisma.business.update({
            where: { id: business.id },
            data: {
              emailVerificationTokenHash: null,
              emailVerificationTokenExpiry: null,
            },
          });
          return NextResponse.json({ error: TOO_MANY_ATTEMPTS_MESSAGE }, { status: 400 });
        }

        await prisma.business.update({
          where: { id: business.id },
          data: {
            emailVerificationTokenHash: packVerificationHash(parsed.tokenHash, nextAttemptCount),
          },
        });
      }

      return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
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
