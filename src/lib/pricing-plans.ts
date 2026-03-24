export type PricingPlanKey = 'STARTER' | 'PRO' | 'PREMIUM';

export interface PublicPricingPlan {
  name: string;
  summary: string;
  price: number;
  compareAtPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: {
    customers: number;
    staff: number;
    services: number;
  };
  popular: boolean;
  selfServe: boolean;
  supportsYearly: boolean;
  legacy: boolean;
}

const CORE_PLAN_FEATURES = [
  'Online booking and calendar management',
  'Customer CRM and visit history',
  'SMS confirmations and reminders',
  'Business email booking alerts',
  'Walk-in check-in',
  'Business analytics and reporting',
  'Paid deals and secure payouts',
  'Referral program and earnings tracking',
];

const AI_RECEPTIONIST_FEATURES = [
  'AI receptionist phone coverage',
  'SMS AI booking and FAQ automation',
];

const STARTER_PLAN_FEATURES = [
  ...CORE_PLAN_FEATURES,
  '14-day free trial',
];

const PRO_AND_PREMIUM_FEATURES = [
  ...CORE_PLAN_FEATURES,
  ...AI_RECEPTIONIST_FEATURES,
  '14-day free trial',
];

const SHARED_PLAN_LIMITS = {
  customers: 5000,
  staff: 15,
  services: 100,
};

export const PRICING_PLANS: Record<PricingPlanKey, PublicPricingPlan> = {
  STARTER: {
    name: 'Starter',
    summary: 'Core Clientific workflow without AI phone coverage.',
    price: 39,
    compareAtPrice: 59,
    yearlyPrice: 39,
    features: STARTER_PLAN_FEATURES,
    limits: SHARED_PLAN_LIMITS,
    popular: false,
    selfServe: true,
    supportsYearly: false,
    legacy: false,
  },
  PRO: {
    name: 'Pro',
    summary: 'Adds AI receptionist to the booking, growth, and payouts workflow.',
    price: 69,
    compareAtPrice: 99,
    yearlyPrice: 69,
    features: PRO_AND_PREMIUM_FEATURES,
    limits: SHARED_PLAN_LIMITS,
    popular: true,
    selfServe: true,
    supportsYearly: false,
    legacy: false,
  },
  PREMIUM: {
    name: 'Premium',
    summary: 'Highest launch tier with AI receptionist included.',
    price: 99,
    compareAtPrice: 149,
    yearlyPrice: 99,
    features: PRO_AND_PREMIUM_FEATURES,
    limits: SHARED_PLAN_LIMITS,
    popular: false,
    selfServe: true,
    supportsYearly: false,
    legacy: false,
  },
};

export const VISIBLE_SELF_SERVE_PLAN_KEYS: PricingPlanKey[] = ['STARTER', 'PRO', 'PREMIUM'];
