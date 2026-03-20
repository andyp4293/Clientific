'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { getPublicPlanSlug } from '@/lib/plan-utils';
import { PRICING_PLANS, VISIBLE_SELF_SERVE_PLAN_KEYS } from '@/lib/pricing-plans';

interface Props {
  status: string;
  hasStripeCustomer: boolean;
  trialExpired?: boolean;
}

export function UpgradePricingCards({ status, hasStripeCustomer, trialExpired = false }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleUpgrade(planSlug: string) {
    setLoading(planSlug);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planSlug, billingPeriod: 'monthly' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to start checkout. Please try again.');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('No checkout URL returned. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to open billing portal. Please try again.');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('No portal URL returned. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  }

  if (status === 'past_due') {
    return (
      <div className="mt-8 flex flex-col items-center gap-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-sm">
          Update your payment method to restore access to your dashboard.
        </p>
        <button
          onClick={handleManageBilling}
          disabled={portalLoading}
          className="btn-primary px-8"
        >
          {portalLoading ? 'Redirecting...' : 'Update Payment Method'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 w-full max-w-3xl mx-auto">
      <div className="grid gap-6">
        {VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => {
          const plan = PRICING_PLANS[key];
          const planSlug = getPublicPlanSlug(key.toLowerCase());
          const price = plan.price;
          const isLoading = loading === planSlug;

          return (
            <div
              key={key}
              className="relative rounded-2xl border border-primary bg-primary/5 dark:bg-primary/10 shadow-lg p-6 flex flex-col"
            >
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{plan.summary}</p>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">${price}</span>
                  <span className="text-gray-400 text-sm mb-1">/month</span>
                </div>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <svg className="w-4 h-4 text-primary shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => void handleUpgrade(planSlug)}
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading
                  ? 'Redirecting...'
                  : status === 'trialing' && !trialExpired
                    ? 'Start 14-day free trial'
                    : 'Continue with $49/month'}
              </button>
            </div>
          );
        })}
      </div>

      {hasStripeCustomer && (
        <div className="mt-6 text-center">
          <button
            onClick={handleManageBilling}
            disabled={portalLoading}
            className="text-sm text-primary hover:underline"
          >
            {portalLoading ? 'Redirecting...' : 'Manage existing subscription'}
          </button>
        </div>
      )}
    </div>
  );
}
