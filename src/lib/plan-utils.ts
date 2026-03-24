export type CanonicalSubscriptionPlan = 'trial' | 'starter' | 'pro' | 'premium';
export type PricingPlanKey = 'STARTER' | 'PRO' | 'PREMIUM';
export type PublicPlanSlug = 'trial' | 'starter' | 'pro' | 'premium';

export function normalizeSubscriptionPlan(plan: string | null | undefined): CanonicalSubscriptionPlan {
  const normalized = typeof plan === 'string' ? plan.trim().toLowerCase() : '';

  switch (normalized) {
    case 'starter':
    case 'base':
      return 'starter';
    case 'pro':
      return 'pro';
    case 'premium':
      return 'premium';
    case 'trial':
      return 'trial';
    default:
      return 'trial';
  }
}

export function getPricingPlanKey(plan: string | null | undefined): PricingPlanKey | null {
  const normalized = normalizeSubscriptionPlan(plan);

  switch (normalized) {
    case 'starter':
      return 'STARTER';
    case 'pro':
      return 'PRO';
    case 'premium':
      return 'PREMIUM';
    default:
      return null;
  }
}

export function getPublicPlanSlug(plan: string | null | undefined): PublicPlanSlug {
  const normalized = normalizeSubscriptionPlan(plan);

  switch (normalized) {
    case 'starter':
      return 'starter';
    case 'pro':
      return 'pro';
    case 'premium':
      return 'premium';
    default:
      return 'trial';
  }
}

export function getPublicPlanLabel(plan: string | null | undefined): string {
  const normalized = normalizeSubscriptionPlan(plan);

  switch (normalized) {
    case 'starter':
      return 'Starter';
    case 'pro':
      return 'Pro';
    case 'premium':
      return 'Premium';
    default:
      return 'Trial';
  }
}
