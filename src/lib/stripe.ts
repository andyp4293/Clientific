import Stripe from 'stripe';
import { sanitizeStripeEnvValue } from './stripe-env';

function readStripeEnv(name: string, fallback: string) {
  return sanitizeStripeEnvValue(process.env[name], fallback);
}

// Trim to strip any accidental newline/whitespace from the env var (common paste issue)
const STRIPE_KEY = readStripeEnv('STRIPE_SECRET_KEY', 'sk_test_placeholder_key_for_build');

// Use the Node.js HTTP client instead of the default fetch-based client.
// Next.js wraps the global fetch with its caching layer, which causes
// StripeConnectionError on outbound API calls in Route Handlers.
export const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: '2024-12-18.acacia' as any,
  typescript: true,
  httpClient: Stripe.createNodeHttpClient(),
});

export type PricingPlan = 'STARTER' | 'PRO' | 'PREMIUM';

// Pricing Plans Configuration
export const PRICING_PLANS = {
  STARTER: {
    name: 'Clientific',
    summary: 'One simple plan for booking, CRM, reminders, deals, and payouts.',
    price: 49,
    yearlyPrice: 39, // Reserved for future annual billing if re-enabled
    priceId: readStripeEnv('STRIPE_STARTER_PRICE_ID', 'price_starter'),
    yearlyPriceId: readStripeEnv('STRIPE_STARTER_YEARLY_PRICE_ID', 'price_starter_yearly'),
    features: [
      'Online booking and calendar management',
      'Customer CRM and visit history',
      'Email and SMS reminders',
      'Walk-in check-in',
      'Business analytics and reporting',
      'Paid deals and secure payouts',
      'AI receptionist tools',
      '14-day free trial',
    ],
    limits: {
      customers: 5000,
      staff: 15,
      services: 100,
    },
    popular: true,
    selfServe: true,
    supportsYearly: false,
    legacy: false,
  },
  PRO: {
    name: 'Pro',
    summary: 'Legacy plan',
    price: 79,
    yearlyPrice: 63, // per month when billed annually ($756/year)
    priceId: readStripeEnv('STRIPE_PRO_PRICE_ID', 'price_pro'),
    yearlyPriceId: readStripeEnv('STRIPE_PRO_YEARLY_PRICE_ID', 'price_pro_yearly'),
    features: [
      'Up to 1,000 customers',
      'Advanced check-in & kiosk mode',
      'Online booking page',
      'Loyalty rewards program',
      'Marketing campaigns',
      'Advanced analytics',
      'Priority support',
      '14-day free trial',
    ],
    limits: {
      customers: 1000,
      staff: 10,
      services: 50,
    },
    popular: false,
    selfServe: false,
    supportsYearly: true,
    legacy: true,
  },
  PREMIUM: {
    name: 'Premium',
    summary: 'Legacy plan',
    price: 149,
    yearlyPrice: 119, // per month when billed annually ($1,428/year)
    priceId: readStripeEnv('STRIPE_PREMIUM_PRICE_ID', 'price_premium'),
    yearlyPriceId: readStripeEnv('STRIPE_PREMIUM_YEARLY_PRICE_ID', 'price_premium_yearly'),
    features: [
      'Unlimited customers',
      'Everything in Pro',
      'Custom branding',
      'API access',
      'Dedicated account manager',
      'White-label option',
      'Custom integrations',
      '14-day free trial',
    ],
    limits: {
      customers: Infinity,
      staff: Infinity,
      services: Infinity,
    },
    popular: false,
    selfServe: false,
    supportsYearly: true,
    legacy: true,
  },
} as const;

export const VISIBLE_SELF_SERVE_PLAN_KEYS = (Object.entries(PRICING_PLANS)
  .filter(([, plan]) => plan.selfServe)
  .map(([key]) => key)) as PricingPlan[];
