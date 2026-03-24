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

const SHARED_PLAN_FEATURES = [
  'Online booking and calendar management',
  'Customer CRM and visit history',
  'SMS confirmations and reminders',
  'Business email booking alerts',
  'Walk-in check-in',
  'Business analytics and reporting',
  'Paid deals and secure payouts',
  'Optional AI receptionist setup',
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
    summary: 'Launch pricing for the full Clientific workflow.',
    price: 39,
    compareAtPrice: 59,
    yearlyPrice: 39,
    features: SHARED_PLAN_FEATURES,
    limits: SHARED_PLAN_LIMITS,
    popular: false,
    selfServe: true,
    supportsYearly: false,
    legacy: false,
  },
  PRO: {
    name: 'Pro',
    summary: 'Our most popular launch price for the same full feature set.',
    price: 69,
    compareAtPrice: 99,
    yearlyPrice: 69,
    features: SHARED_PLAN_FEATURES,
    limits: SHARED_PLAN_LIMITS,
    popular: true,
    selfServe: true,
    supportsYearly: false,
    legacy: false,
  },
  PREMIUM: {
    name: 'Premium',
    summary: 'Highest launch tier, with the same current feature access while packaging evolves.',
    price: 99,
    compareAtPrice: 149,
    yearlyPrice: 99,
    features: SHARED_PLAN_FEATURES,
    limits: SHARED_PLAN_LIMITS,
    popular: false,
    selfServe: true,
    supportsYearly: false,
    legacy: false,
  },
};

export const VISIBLE_SELF_SERVE_PLAN_KEYS: PricingPlanKey[] = ['STARTER', 'PRO', 'PREMIUM'];
