/**
 * Centralized referral program configuration.
 *
 * All referral payout math and trial-length logic should import from here
 * so that changing a single constant propagates everywhere automatically.
 */

/**
 * Percentage of the referee's first month payment credited back to the referrer.
 * e.g. 0.20 = 20%.  Higher-tier subscribers generate a proportionally larger reward,
 * which naturally incentivises referrers to pitch the best-fit plan.
 */
export const REFERRAL_COMMISSION_PERCENT = 0.3;

/** Human-readable string for UI display, e.g. "20%". */
export const REFERRAL_COMMISSION_DISPLAY = `${Math.round(REFERRAL_COMMISSION_PERCENT * 100)}%`;

/** Trial days granted when a new business signs up via a referral or affiliate link. */
export const REFERRAL_BONUS_TRIAL_DAYS = 44;

/** Standard trial days for businesses that sign up without any referral. */
export const STANDARD_TRIAL_DAYS = 14;
