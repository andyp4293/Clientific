import { describe, expect, it } from 'vitest';
import { buildPayoutFundsBreakdown } from './payout-funds';

describe('buildPayoutFundsBreakdown', () => {
  it('explains Stripe settlement and referral transfer reasons when setup is complete', () => {
    const result = buildPayoutFundsBreakdown({
      availableAmountCents: 12500,
      stripePendingAmountCents: 4300,
      referralPendingAmountCents: 870,
      referralPendingCount: 1,
      readyForPaidDeals: true,
    });

    expect(result.availableDescription).toMatch(/ready for your next stripe payout/i);
    expect(result.pendingAmountCents).toBe(5170);
    expect(result.pendingReasons).toEqual([
      expect.objectContaining({
        id: 'stripe_settlement',
        label: 'Recent deal payments',
      }),
      expect.objectContaining({
        id: 'referral_transfer',
        label: 'Referral earnings still moving to Stripe',
      }),
    ]);
  });

  it('explains that referral earnings are blocked on setup when payouts are not ready', () => {
    const result = buildPayoutFundsBreakdown({
      availableAmountCents: 0,
      stripePendingAmountCents: 0,
      referralPendingAmountCents: 1740,
      referralPendingCount: 2,
      readyForPaidDeals: false,
    });

    expect(result.availableDescription).toMatch(/finish payout setup/i);
    expect(result.pendingReasons).toEqual([
      expect.objectContaining({
        id: 'referral_setup',
        label: 'Referral earnings waiting on payout setup',
        description: expect.stringMatching(/finish payout setup/i),
      }),
    ]);
  });

  it('shows a clean empty state when nothing is pending', () => {
    const result = buildPayoutFundsBreakdown({
      availableAmountCents: 0,
      stripePendingAmountCents: 0,
      referralPendingAmountCents: 0,
      referralPendingCount: 0,
      readyForPaidDeals: true,
    });

    expect(result.pendingAmountCents).toBe(0);
    expect(result.pendingDescription).toBe('Nothing is pending right now.');
    expect(result.pendingReasons).toEqual([]);
  });
});
