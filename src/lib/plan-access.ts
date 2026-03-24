import {
  normalizeSubscriptionPlan,
  type CanonicalSubscriptionPlan,
} from './plan-utils';

export const PLAN_HIERARCHY: CanonicalSubscriptionPlan[] = [
  'trial',
  'starter',
  'pro',
  'premium',
];

export const AI_RECEPTIONIST_REQUIRED_PLAN: CanonicalSubscriptionPlan = 'pro';

export function requiresPlanUpgrade(
  currentPlan: string | null | undefined,
  requiredPlan: CanonicalSubscriptionPlan
): boolean {
  const currentIndex = PLAN_HIERARCHY.indexOf(normalizeSubscriptionPlan(currentPlan));
  const requiredIndex = PLAN_HIERARCHY.indexOf(normalizeSubscriptionPlan(requiredPlan));

  return currentIndex < requiredIndex;
}

export function hasPlanAccess(
  currentPlan: string | null | undefined,
  requiredPlan: CanonicalSubscriptionPlan
): boolean {
  return !requiresPlanUpgrade(currentPlan, requiredPlan);
}

export function canAccessAiReceptionist(
  currentPlan: string | null | undefined
): boolean {
  return hasPlanAccess(currentPlan, AI_RECEPTIONIST_REQUIRED_PLAN);
}
