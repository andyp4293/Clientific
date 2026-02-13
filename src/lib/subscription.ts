import { prisma } from './prisma';
import { PRICING_PLANS } from './stripe';

export type SubscriptionStatus = 
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

export type SubscriptionPlan = 'trial' | 'starter' | 'pro' | 'premium';

/**
 * Check if a business has an active subscription (including trial)
 */
export async function hasActiveSubscription(businessId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  });

  if (!business) return false;

  // Allow access during trial
  if (business.subscriptionStatus === 'trialing' && business.trialEndsAt) {
    return new Date() < new Date(business.trialEndsAt);
  }

  // Allow access if subscription is active
  return business.subscriptionStatus === 'active';
}

/**
 * Check if a business is within feature limits for their plan
 */
export async function checkPlanLimit(
  businessId: string,
  limitType: 'customers' | 'staff' | 'services'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionPlan: true,
      _count: {
        select: {
          customers: limitType === 'customers',
          staff: limitType === 'staff',
          services: limitType === 'services',
        },
      },
    },
  });

  if (!business) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const plan = business.subscriptionPlan.toUpperCase() as keyof typeof PRICING_PLANS;
  const planConfig = PRICING_PLANS[plan] || PRICING_PLANS.STARTER;
  const limit = planConfig.limits[limitType];
  const current = business._count[limitType] || 0;

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

/**
 * Get days remaining in trial
 */
export async function getTrialDaysRemaining(businessId: string): Promise<number | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  });

  if (!business || business.subscriptionStatus !== 'trialing' || !business.trialEndsAt) {
    return null;
  }

  const now = new Date();
  const trialEnd = new Date(business.trialEndsAt);
  const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return Math.max(0, daysRemaining);
}

/**
 * Get subscription info for a business
 */
export async function getSubscriptionInfo(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      stripeCurrentPeriodEnd: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!business) return null;

  const trialDaysRemaining = await getTrialDaysRemaining(businessId);
  const isActive = await hasActiveSubscription(businessId);

  return {
    ...business,
    trialDaysRemaining,
    isActive,
  };
}

/**
 * Check if business needs to upgrade to access a feature
 */
export function requiresPlanUpgrade(
  currentPlan: SubscriptionPlan,
  requiredPlan: 'starter' | 'pro' | 'premium'
): boolean {
  const planHierarchy = ['trial', 'starter', 'pro', 'premium'];
  const currentIndex = planHierarchy.indexOf(currentPlan);
  const requiredIndex = planHierarchy.indexOf(requiredPlan);
  
  return currentIndex < requiredIndex;
}
