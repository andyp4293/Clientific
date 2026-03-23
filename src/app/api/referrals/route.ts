import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generateReferralCode } from '@/lib/referral';
import {
  getReferralSharingStatus,
  resolveReferralSharingStatus,
} from '@/lib/referral-sharing';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: {
        id: true,
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
            creditedAt: true,
            commissions: {
              select: {
                amountDollars: true,
              },
            },
            referee: {
              select: { name: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    let sharingStatus = getReferralSharingStatus(business);
    if (business.stripeConnectAccountId) {
      try {
        sharingStatus = await resolveReferralSharingStatus(business);
      } catch (error) {
        console.warn(
          'Referrals fetch could not refresh payout readiness, falling back to cached status:',
          error
        );
      }
    }

    // Lazy-generate referral code for businesses created before the feature existed,
    // but only after payout setup is ready for live referral sharing.
    if (sharingStatus.ready && !business.referralCode) {
      const code = await generateReferralCode();
      await prisma.business.update({
        where: { id: session.user.businessId },
        data: { referralCode: code },
      });
      business = { ...business, referralCode: code };
    }

    const referrals = business.referralsMade.map(referral => {
      const creditAmount = referral.commissions.reduce(
        (sum, commission) => sum + commission.amountDollars,
        0
      );

      return {
        id: referral.id,
        createdAt: referral.createdAt,
        status: referral.status,
        creditAmount,
        creditedAt: referral.creditedAt,
        referee: referral.referee,
      };
    });

    const totalCredits = referrals.reduce((sum, referral) => sum + referral.creditAmount, 0);

    return NextResponse.json({
      referralCode: sharingStatus.ready ? business.referralCode : null,
      totalCredits,
      referrals,
      payoutReady: sharingStatus.ready,
      payoutStatusCode: sharingStatus.code,
      payoutSetupMessage: sharingStatus.ready ? null : sharingStatus.message,
    });
  } catch (error: any) {
    console.error('Referrals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
  }
}
