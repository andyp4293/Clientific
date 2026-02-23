import Stripe from 'stripe';

// Use placeholder key if not set (for build purposes)
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_for_build';

export const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: '2024-12-18.acacia' as any,
  typescript: true,
});

// Pricing Plans Configuration
export const PRICING_PLANS = {
  STARTER: {
    name: 'Starter',
    price: 29,
    yearlyPrice: 23, // per month when billed annually ($276/year)
    priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
    yearlyPriceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || 'price_starter_yearly',
    features: [
      'Up to 100 customers',
      'Basic check-in system',
      'Email & SMS notifications',
      'Basic analytics',
      '14-day free trial',
    ],
    limits: {
      customers: 100,
      staff: 2,
      services: 10,
    },
    popular: false,
  },
  PRO: {
    name: 'Pro',
    price: 79,
    yearlyPrice: 63, // per month when billed annually ($756/year)
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
    yearlyPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
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
    popular: true,
  },
  PREMIUM: {
    name: 'Premium',
    price: 149,
    yearlyPrice: 119, // per month when billed annually ($1,428/year)
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID || 'price_premium',
    yearlyPriceId: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID || 'price_premium_yearly',
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
  },
} as const;

export type PricingPlan = keyof typeof PRICING_PLANS;
