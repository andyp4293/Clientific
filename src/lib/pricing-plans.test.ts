import { describe, expect, it } from 'vitest';
import { PRICING_PLANS } from './pricing-plans';

describe('pricing plans', () => {
  it('keeps AI receptionist off Starter and on Pro/Premium', () => {
    expect(
      PRICING_PLANS.STARTER.features.some((feature) => /ai receptionist/i.test(feature))
    ).toBe(false);
    expect(
      PRICING_PLANS.PRO.features.some((feature) => /ai receptionist/i.test(feature))
    ).toBe(true);
    expect(
      PRICING_PLANS.PREMIUM.features.some((feature) => /ai receptionist/i.test(feature))
    ).toBe(true);
  });

  it('preserves the public monthly prices', () => {
    expect(PRICING_PLANS.STARTER.price).toBe(39);
    expect(PRICING_PLANS.PRO.price).toBe(69);
    expect(PRICING_PLANS.PREMIUM.price).toBe(99);
  });
});
