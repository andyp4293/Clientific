type BusinessPaidDealPayoutSeed = {
  stripeConnectAccountId: string | null;
  stripeConnectChargesEnabled?: boolean | null;
  stripeConnectPayoutsEnabled?: boolean | null;
  stripeConnectDetailsSubmitted?: boolean | null;
};

type DealPayoutSeed = {
  deliveryType?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
};

export type PaidDealPayoutStatus = {
  ready: boolean;
  code:
    | 'ready'
    | 'not_connected'
    | 'onboarding_incomplete'
    | 'charges_disabled'
    | 'payouts_disabled';
  message: string;
};

export function dealRequiresPayoutSetup(deal: DealPayoutSeed) {
  if (deal.deliveryType !== 'purchase_link') {
    return false;
  }

  if (deal.discountType === 'free_service') {
    return false;
  }

  if (deal.discountType === 'percent_off' && Number(deal.discountValue ?? 0) >= 100) {
    return false;
  }

  return true;
}

export function getPaidDealPayoutStatus(
  business: BusinessPaidDealPayoutSeed
): PaidDealPayoutStatus {
  if (!business.stripeConnectAccountId) {
    return {
      ready: false,
      code: 'not_connected',
      message:
        'Finish payout setup in Dashboard > Payouts before publishing paid deal purchases.',
    };
  }

  if (!business.stripeConnectDetailsSubmitted) {
    return {
      ready: false,
      code: 'onboarding_incomplete',
      message:
        'Finish the Stripe-powered payout setup before publishing paid deal purchases.',
    };
  }

  if (!business.stripeConnectChargesEnabled) {
    return {
      ready: false,
      code: 'charges_disabled',
      message:
        'Stripe is still reviewing this payout setup. Paid deal purchases can go live once charges are enabled.',
    };
  }

  if (!business.stripeConnectPayoutsEnabled) {
    return {
      ready: false,
      code: 'payouts_disabled',
      message:
        'Connect a bank account and resolve any Stripe payout requirements before publishing paid deal purchases.',
    };
  }

  return {
    ready: true,
    code: 'ready',
    message: 'Paid deal payouts are ready.',
  };
}

export function isBusinessReadyForPaidDeals(business: BusinessPaidDealPayoutSeed) {
  return getPaidDealPayoutStatus(business).ready;
}
