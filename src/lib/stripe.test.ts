import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID,
  STRIPE_STARTER_YEARLY_PRICE_ID: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
  STRIPE_PRO_YEARLY_PRICE_ID: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  STRIPE_PREMIUM_PRICE_ID: process.env.STRIPE_PREMIUM_PRICE_ID,
  STRIPE_PREMIUM_YEARLY_PRICE_ID: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID,
};

async function loadStripeModule() {
  vi.resetModules();
  return import('./stripe');
}

afterEach(() => {
  process.env.STRIPE_SECRET_KEY = ORIGINAL_ENV.STRIPE_SECRET_KEY;
  process.env.STRIPE_STARTER_PRICE_ID = ORIGINAL_ENV.STRIPE_STARTER_PRICE_ID;
  process.env.STRIPE_STARTER_YEARLY_PRICE_ID = ORIGINAL_ENV.STRIPE_STARTER_YEARLY_PRICE_ID;
  process.env.STRIPE_PRO_PRICE_ID = ORIGINAL_ENV.STRIPE_PRO_PRICE_ID;
  process.env.STRIPE_PRO_YEARLY_PRICE_ID = ORIGINAL_ENV.STRIPE_PRO_YEARLY_PRICE_ID;
  process.env.STRIPE_PREMIUM_PRICE_ID = ORIGINAL_ENV.STRIPE_PREMIUM_PRICE_ID;
  process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID = ORIGINAL_ENV.STRIPE_PREMIUM_YEARLY_PRICE_ID;
});

describe('stripe billing config', () => {
  it('trims whitespace from Stripe secret and price IDs', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_trim_me\\n';
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_monthly\\n';
    process.env.STRIPE_STARTER_YEARLY_PRICE_ID = 'price_starter_yearly \n';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_monthly\\r\\n';
    process.env.STRIPE_PRO_YEARLY_PRICE_ID = 'price_pro_yearly \n';
    process.env.STRIPE_PREMIUM_PRICE_ID = 'price_premium_monthly\\n';
    process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID = 'price_premium_yearly \n';

    const { PRICING_PLANS } = await loadStripeModule();

    expect(PRICING_PLANS.STARTER.priceId).toBe('price_starter_monthly');
    expect(PRICING_PLANS.STARTER.yearlyPriceId).toBe('price_starter_yearly');
    expect(PRICING_PLANS.PRO.priceId).toBe('price_pro_monthly');
    expect(PRICING_PLANS.PREMIUM.yearlyPriceId).toBe('price_premium_yearly');
  });

  it('exposes the three launch self-serve plans with Pro+ AI receptionist access and launch pricing', async () => {
    const { PRICING_PLANS, VISIBLE_SELF_SERVE_PLAN_KEYS } = await loadStripeModule();

    expect(VISIBLE_SELF_SERVE_PLAN_KEYS).toEqual(['STARTER', 'PRO', 'PREMIUM']);
    expect(PRICING_PLANS.STARTER.price).toBe(39);
    expect(PRICING_PLANS.STARTER.compareAtPrice).toBe(59);
    expect(PRICING_PLANS.STARTER.supportsYearly).toBe(false);
    expect(PRICING_PLANS.PRO.price).toBe(69);
    expect(PRICING_PLANS.PRO.compareAtPrice).toBe(99);
    expect(PRICING_PLANS.PREMIUM.price).toBe(99);
    expect(PRICING_PLANS.PREMIUM.compareAtPrice).toBe(149);
    expect(
      PRICING_PLANS.STARTER.features.some((feature) => /ai receptionist/i.test(feature))
    ).toBe(false);
    expect(
      PRICING_PLANS.PRO.features.some((feature) => /ai receptionist/i.test(feature))
    ).toBe(true);
    expect(
      PRICING_PLANS.STARTER.features.some((feature) => /10 staff profiles/i.test(feature))
    ).toBe(true);
    expect(
      PRICING_PLANS.PRO.features.some((feature) => /50 staff profiles/i.test(feature))
    ).toBe(true);
    expect(
      PRICING_PLANS.PREMIUM.features.some((feature) => /unlimited staff profiles/i.test(feature))
    ).toBe(true);
    expect(PRICING_PLANS.STARTER.limits.staff).toBe(10);
    expect(PRICING_PLANS.PRO.limits.staff).toBe(50);
    expect(PRICING_PLANS.PREMIUM.limits.staff).toBe(Infinity);
    expect(PRICING_PLANS.STARTER.selfServe).toBe(true);
    expect(PRICING_PLANS.PRO.selfServe).toBe(true);
    expect(PRICING_PLANS.PREMIUM.selfServe).toBe(true);
  });
});
