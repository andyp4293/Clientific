import Stripe from 'stripe';
import { sanitizeStripeEnvValue } from './stripe-env';
import {
  PRICING_PLANS as PUBLIC_PRICING_PLANS,
  VISIBLE_SELF_SERVE_PLAN_KEYS,
  type PricingPlanKey,
} from './pricing-plans';

function readStripeEnv(name: string, fallback: string) {
  return sanitizeStripeEnvValue(process.env[name], fallback);
}

// Trim to strip any accidental newline/whitespace from the env var (common paste issue)
const STRIPE_KEY = readStripeEnv('STRIPE_SECRET_KEY', 'sk_test_placeholder_key_for_build');
export const STRIPE_API_VERSION = '2024-12-18.acacia';

// Use the Node.js HTTP client instead of the default fetch-based client.
// Next.js wraps the global fetch with its caching layer, which causes
// StripeConnectionError on outbound API calls in Route Handlers.
export const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: STRIPE_API_VERSION as any,
  typescript: true,
  httpClient: Stripe.createNodeHttpClient(),
});

export type PricingPlan = PricingPlanKey;
type StripePricingPlan = (typeof PUBLIC_PRICING_PLANS)[PricingPlanKey] & {
  priceId: string;
  yearlyPriceId: string;
};

// Pricing Plans Configuration
export const PRICING_PLANS: Record<PricingPlanKey, StripePricingPlan> = {
  STARTER: {
    ...PUBLIC_PRICING_PLANS.STARTER,
    priceId: readStripeEnv('STRIPE_STARTER_PRICE_ID', 'price_starter'),
    yearlyPriceId: readStripeEnv('STRIPE_STARTER_YEARLY_PRICE_ID', 'price_starter_yearly'),
  },
  PRO: {
    ...PUBLIC_PRICING_PLANS.PRO,
    priceId: readStripeEnv('STRIPE_PRO_PRICE_ID', 'price_pro'),
    yearlyPriceId: readStripeEnv('STRIPE_PRO_YEARLY_PRICE_ID', 'price_pro_yearly'),
  },
  PREMIUM: {
    ...PUBLIC_PRICING_PLANS.PREMIUM,
    priceId: readStripeEnv('STRIPE_PREMIUM_PRICE_ID', 'price_premium'),
    yearlyPriceId: readStripeEnv('STRIPE_PREMIUM_YEARLY_PRICE_ID', 'price_premium_yearly'),
  },
};

export { VISIBLE_SELF_SERVE_PLAN_KEYS };
