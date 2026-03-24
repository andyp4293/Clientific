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
      <div className="mb-5 rounded-[24px] border border-primary/15 bg-primary/[0.06] px-5 py-4 text-sm leading-6 text-gray-700 dark:border-primary/20 dark:bg-primary/[0.08] dark:text-gray-200">
        Starter includes the core Clientific workflow. Pro and Premium add AI receptionist on top
        of booking, CRM, deals, referrals, and payouts.
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => {
          const plan = PRICING_PLANS[key];
          const planSlug = getPublicPlanSlug(key.toLowerCase());
          const price = plan.price;
          const isLoading = loading === planSlug;
          const monthlySavings = plan.compareAtPrice - plan.price;
          const yearlySavings = monthlySavings * 12;
          const discountPercent = Math.round((monthlySavings / plan.compareAtPrice) * 100);

          return (
            <div
              key={key}
              className={`relative rounded-[28px] border p-6 shadow-lg flex flex-col ${
                plan.popular
                  ? 'border-primary bg-primary/8 shadow-primary/15 dark:bg-primary/12'
                  : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/[0.03]'
              }`}
            >
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      plan.popular
                        ? 'bg-primary text-white'
                        : 'border border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200'
                    }`}
                  >
                    {plan.popular ? 'Most Popular' : 'Special Pricing'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{plan.summary}</p>
                <div className="mt-4 rounded-2xl border border-gray-200/80 bg-gray-50/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Regularly
                  </p>
                  <div className="mt-1 text-base font-semibold text-gray-400 line-through decoration-2 dark:text-gray-500">
                    ${plan.compareAtPrice}/month
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                      Today
                    </span>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">${price}</span>
                      <span className="mb-1 text-sm text-gray-400">/month</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm dark:border-emerald-900/30 dark:bg-emerald-900/20">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                      Save
                    </p>
                    <p className="mt-1 font-semibold text-emerald-900 dark:text-emerald-100">${monthlySavings}/mo</p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3 text-sm dark:border-primary/30 dark:bg-primary/15">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary dark:text-primary-200">
                      Discount
                    </p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{discountPercent}% off</p>
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium text-primary dark:text-primary-200">
                  That is ${yearlySavings}/year below the regular monthly rate.
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  {key === 'STARTER' ? 'Core workflow' : 'AI receptionist included'}
                </p>
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
                    ? `Choose ${plan.name}`
                    : `Select ${plan.name}`}
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
