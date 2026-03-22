import { prisma } from '@/lib/prisma';
import {
  isRecoverableConnectAccountError,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';

export type ReferralSharingStatusCode =
  | 'ready'
  | 'not_connected'
  | 'onboarding_incomplete'
  | 'charges_disabled'
  | 'payouts_disabled';

export type ReferralSharingStatus = {
  ready: boolean;
  code: ReferralSharingStatusCode;
  message: string;
};

export type ReferralSharingBusinessSeed = {
  id: string;
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled?: boolean | null;
  stripeConnectPayoutsEnabled?: boolean | null;
  stripeConnectDetailsSubmitted?: boolean | null;
};

export function getReferralSharingStatus(
  business: Omit<ReferralSharingBusinessSeed, 'id'> | ReferralSharingBusinessSeed | null | undefined
): ReferralSharingStatus {
  if (!business?.stripeConnectAccountId) {
    return {
      ready: false,
      code: 'not_connected',
      message:
        'Finish payout setup in Dashboard > Payouts before sharing your referral link.',
    };
  }

  if (!business.stripeConnectDetailsSubmitted) {
    return {
      ready: false,
      code: 'onboarding_incomplete',
      message:
        'Finish the secure Stripe payout setup before sharing your referral link.',
    };
  }

  if (!business.stripeConnectChargesEnabled) {
    return {
      ready: false,
      code: 'charges_disabled',
      message:
        'Stripe is still activating money movement for this payout setup. You can share referral links once that review finishes.',
    };
  }

  if (!business.stripeConnectPayoutsEnabled) {
    return {
      ready: false,
      code: 'payouts_disabled',
      message:
        'Connect a bank account and resolve any Stripe payout requirements before sharing your referral link.',
    };
  }

  return {
    ready: true,
    code: 'ready',
    message: 'Referral link sharing is ready.',
  };
}

async function clearStaleConnectState(businessId: string) {
  await Promise.all([
    prisma.business.update({
      where: { id: businessId },
      data: {
        stripeConnectAccountId: null,
        stripeConnectChargesEnabled: false,
        stripeConnectPayoutsEnabled: false,
        stripeConnectDetailsSubmitted: false,
        stripeConnectOnboardedAt: null,
        stripeConnectLastSyncedAt: new Date(),
      },
    }),
    prisma.businessBankAccount.deleteMany({
      where: { businessId },
    }),
  ]);
}

export async function resolveReferralSharingStatus(
  business: ReferralSharingBusinessSeed
): Promise<ReferralSharingStatus> {
  if (!business.stripeConnectAccountId) {
    return getReferralSharingStatus(business);
  }

  try {
    const status = await syncBusinessConnectState(
      business.id,
      business.stripeConnectAccountId
    );

    return getReferralSharingStatus({
      stripeConnectAccountId: status.accountId,
      stripeConnectChargesEnabled: status.chargesEnabled,
      stripeConnectPayoutsEnabled: status.payoutsEnabled,
      stripeConnectDetailsSubmitted: status.detailsSubmitted,
    });
  } catch (error) {
    if (!isRecoverableConnectAccountError(error)) {
      throw error;
    }

    await clearStaleConnectState(business.id);

    return getReferralSharingStatus({
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDetailsSubmitted: false,
    });
  }
}
