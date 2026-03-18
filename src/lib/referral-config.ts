/**
 * Centralized referral program configuration.
 *
 * All referral payout math and trial-length logic should import from here
 * so that changing a single constant propagates everywhere automatically.
 */

/**
 * Percentage of every referee invoice payment credited back to the referrer.
 * Fires every month the referee stays subscribed — not just the first month.
 * e.g. 0.30 = 30%.  Higher-tier subscribers generate a proportionally larger reward,
 * which naturally incentivises referrers to pitch the best-fit plan.
 *
 * Change this one value to adjust the commission rate everywhere automatically.
 */
export const REFERRAL_COMMISSION_PERCENT = 0.3;

/** Human-readable string for UI display, e.g. "20%". */
export const REFERRAL_COMMISSION_DISPLAY = `${Math.round(REFERRAL_COMMISSION_PERCENT * 100)}%`;

/** Standard trial days for all new businesses. */
export const STANDARD_TRIAL_DAYS = 14;
