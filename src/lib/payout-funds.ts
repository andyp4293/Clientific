export type PayoutFundsBreakdownInput = {
  availableAmountCents: number;
  stripePendingAmountCents: number;
  dealPendingAmountCents: number;
  dealPendingCount: number;
  referralPendingAmountCents: number;
  referralPendingCount: number;
  readyForPaidDeals: boolean;
};

export type PendingFundsReason = {
  id:
    | 'stripe_settlement'
    | 'deal_setup'
    | 'deal_transfer'
    | 'referral_setup'
    | 'referral_transfer';
  label: string;
  amountCents: number;
  description: string;
};

export type PayoutFundsBreakdown = {
  availableAmountCents: number;
  availableDescription: string;
  pendingAmountCents: number;
  pendingDescription: string;
  pendingReasons: PendingFundsReason[];
};

function pluralizeReferralCount(count: number) {
  if (count <= 0) {
    return 'Recorded referral earnings are still waiting to move.';
  }

  return count === 1
    ? '1 recorded referral commission is still waiting to move.'
    : `${count} recorded referral commissions are still waiting to move.`;
}

function pluralizeDealCount(count: number) {
  if (count <= 0) {
    return 'Recorded deal earnings are still waiting to move.';
  }

  return count === 1
    ? '1 recorded deal purchase is still waiting to move.'
    : `${count} recorded deal purchases are still waiting to move.`;
}

export function buildPayoutFundsBreakdown(
  input: PayoutFundsBreakdownInput
): PayoutFundsBreakdown {
  const {
    availableAmountCents,
    stripePendingAmountCents,
    dealPendingAmountCents,
    dealPendingCount,
    referralPendingAmountCents,
    referralPendingCount,
    readyForPaidDeals,
  } = input;

  const pendingReasons: PendingFundsReason[] = [];

  if (stripePendingAmountCents > 0) {
    pendingReasons.push({
      id: 'stripe_settlement',
      label: 'Recent deal payments',
      amountCents: stripePendingAmountCents,
      description: readyForPaidDeals
        ? 'These payments are still clearing through Stripe before they move into your available balance.'
        : 'These payments still need to clear through Stripe. Even after they clear, payouts stay paused until your payout setup is finished.',
    });
  }

  if (dealPendingAmountCents > 0) {
    pendingReasons.push({
      id: readyForPaidDeals ? 'deal_transfer' : 'deal_setup',
      label: readyForPaidDeals
        ? 'Older deal earnings still moving to Stripe'
        : 'Older deal earnings waiting on payout setup',
      amountCents: dealPendingAmountCents,
      description: readyForPaidDeals
        ? `${pluralizeDealCount(dealPendingCount)} Clientific moves them into your Stripe payout balance automatically.`
        : `${pluralizeDealCount(dealPendingCount)} Finish payout setup so Clientific can move them into your Stripe payout balance.`,
    });
  }

  if (referralPendingAmountCents > 0) {
    pendingReasons.push({
      id: readyForPaidDeals ? 'referral_transfer' : 'referral_setup',
      label: readyForPaidDeals
        ? 'Referral earnings still moving to Stripe'
        : 'Referral earnings waiting on payout setup',
      amountCents: referralPendingAmountCents,
      description: readyForPaidDeals
        ? `${pluralizeReferralCount(referralPendingCount)} Clientific moves them into your Stripe payout balance automatically.`
        : `${pluralizeReferralCount(referralPendingCount)} Finish payout setup so Clientific can move them into your Stripe payout balance.`,
    });
  }

  const pendingAmountCents =
    stripePendingAmountCents + dealPendingAmountCents + referralPendingAmountCents;

  return {
    availableAmountCents,
    availableDescription:
      availableAmountCents > 0
        ? 'Ready for your next Stripe payout.'
        : readyForPaidDeals
          ? 'No cleared payout balance yet. New sales appear here after Stripe finishes settlement.'
          : 'No cleared payout balance yet. Finish payout setup before paid payouts can go live.',
    pendingAmountCents,
    pendingDescription:
      pendingAmountCents > 0
        ? 'Some funds are still waiting before they can be paid out.'
        : 'Nothing is pending right now.',
    pendingReasons,
  };
}
