import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { generateReferralCode } from '@/lib/referral';
import {
  getReferralSharingStatus,
  resolveReferralSharingStatus,
} from '@/lib/referral-sharing';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateLabel(value: Date) {
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStatusLabel(status: string) {
  if (status === 'credited') {
    return 'Paying';
  }

  if (status === 'pending') {
    return 'In setup';
  }

  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.accountType === 'staff') {
      return NextResponse.json(
        { error: 'Employee accounts can only access assigned appointments.' },
        { status: 403 },
      );
    }

    let business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        email: true,
        name: true,
        businessType: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        referralCode: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
        referralsMade: {
          select: {
            id: true,
            createdAt: true,
            status: true,
            commissions: {
              select: {
                amountDollars: true,
              },
            },
            referee: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let sharingStatus = getReferralSharingStatus(business);
    if (business.stripeConnectAccountId) {
      try {
        sharingStatus = await resolveReferralSharingStatus(business);
      } catch (error) {
        console.warn('Mobile referrals could not refresh payout readiness:', error);
      }
    }

    if (sharingStatus.ready && !business.referralCode) {
      const code = await generateReferralCode();
      await prisma.business.update({
        where: { id: session.businessId },
        data: { referralCode: code },
      });
      business = { ...business, referralCode: code };
    }

    const referrals = business.referralsMade.map((referral) => {
      const creditAmount = referral.commissions.reduce(
        (sum, commission) => sum + commission.amountDollars,
        0,
      );

      return {
        id: referral.id,
        refereeName: referral.referee.name,
        startedAtLabel: formatDateLabel(referral.createdAt),
        statusLabel: formatStatusLabel(referral.status),
        creditAmountLabel: formatCurrency(creditAmount),
        creditAmount,
      };
    });

    const totalCredits = referrals.reduce((sum, referral) => sum + referral.creditAmount, 0);
    const activeCount = business.referralsMade.filter(
      (referral) => referral.status === 'active' || referral.status === 'credited',
    ).length;
    const pendingCount = business.referralsMade.filter(
      (referral) => referral.status === 'pending',
    ).length;

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      referralCode: sharingStatus.ready ? business.referralCode : null,
      payoutReady: sharingStatus.ready,
      payoutSetupMessage: sharingStatus.ready ? null : sharingStatus.message,
      totalCredits,
      activeCount,
      pendingCount,
      referrals: referrals.map(({ creditAmount, ...referral }) => referral),
    });
  } catch (error) {
    console.error('GET /api/mobile/referrals error:', error);
    return NextResponse.json({ error: 'Unable to load mobile referrals' }, { status: 500 });
  }
}
