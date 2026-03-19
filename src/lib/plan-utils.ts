export type CanonicalSubscriptionPlan = 'trial' | 'base' | 'pro' | 'premium';
export type PricingPlanKey = 'STARTER' | 'PRO' | 'PREMIUM';
export type PublicPlanSlug = 'trial' | 'base' | 'pro' | 'premium';

export const VISIBLE_SELF_SERVE_PLAN_KEYS: PricingPlanKey[] = ['STARTER', 'PRO'];

export const SELF_SERVE_PLAN_SUMMARIES: Record<PricingPlanKey, string> = {
  STARTER: 'Great for solo operators',
  PRO: 'For growing businesses',
  PREMIUM: 'Legacy plan',
};

export function normalizeSubscriptionPlan(plan: string | null | undefined): CanonicalSubscriptionPlan {
  const normalized = typeof plan === 'string' ? plan.trim().toLowerCase() : '';

  switch (normalized) {
    case 'starter':
    case 'base':
      return 'base';
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
    case 'base':
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
    case 'base':
      return 'base';
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
    case 'base':
      return 'Base';
    case 'pro':
      return 'Pro';
    case 'premium':
      return 'Premium';
    default:
      return 'Trial';
  }
}
