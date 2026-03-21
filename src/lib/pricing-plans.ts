export type PricingPlanKey = 'STARTER' | 'PRO' | 'PREMIUM';

export interface PublicPricingPlan {
  name: string;
  summary: string;
  price: number;
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

export const PRICING_PLANS: Record<PricingPlanKey, PublicPricingPlan> = {
  STARTER: {
    name: 'Clientific',
    summary: 'One simple plan for booking, CRM, deals, referrals, and secure payouts.',
    price: 49,
    yearlyPrice: 39,
    features: [
      'Online booking and calendar management',
      'Customer CRM and visit history',
      'SMS confirmations and reminders',
      'Business email booking alerts',
      'Walk-in check-in',
      'Business analytics and reporting',
      'Paid deals and secure payouts',
      'Optional AI receptionist setup',
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
    yearlyPrice: 63,
    features: [
      'Up to 1,000 customers',
      'Advanced check-in & kiosk mode',
      'Online booking page',
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
    yearlyPrice: 119,
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
      customers: Number.POSITIVE_INFINITY,
      staff: Number.POSITIVE_INFINITY,
      services: Number.POSITIVE_INFINITY,
    },
    popular: false,
    selfServe: false,
    supportsYearly: true,
    legacy: true,
  },
};

export const VISIBLE_SELF_SERVE_PLAN_KEYS = (Object.entries(PRICING_PLANS)
  .filter(([, plan]) => plan.selfServe)
  .map(([key]) => key)) as PricingPlanKey[];
