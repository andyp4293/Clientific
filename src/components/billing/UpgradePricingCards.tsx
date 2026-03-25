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
      <div className="mb-5 rounded-[28px] border border-primary/15 bg-gradient-to-r from-primary/[0.08] via-white to-white px-5 py-5 text-sm leading-6 text-gray-700 shadow-sm dark:border-primary/20 dark:bg-gradient-to-r dark:from-primary/[0.14] dark:via-white/[0.04] dark:to-white/[0.02] dark:text-gray-200">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary dark:text-primary-200">
              Plan Access
            </p>
            <p className="mt-2 font-semibold text-gray-900 dark:text-gray-100">
              Starter includes the core Clientific workflow.
            </p>
            <p className="mt-1">
              Pro and Premium add AI receptionist on top of booking, CRM, deals, referrals, and
              payouts.
            </p>
          </div>
          <div className="grid gap-2 min-[480px]:grid-cols-2">
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.05]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Trial
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">14 days free</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.05]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Billing
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">Monthly access</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => {
          const plan = PRICING_PLANS[key];
          const planSlug = getPublicPlanSlug(key.toLowerCase());
          const price = plan.price;
          const isLoading = loading === planSlug;
          return (
            <div
              key={key}
              className={`relative flex flex-col overflow-hidden rounded-[30px] border p-6 shadow-[0_18px_60px_rgba(6,17,24,0.08)] ${
                plan.popular
                  ? 'border-primary/30 bg-gradient-to-b from-primary/[0.12] via-white to-white shadow-[0_24px_80px_rgba(15,190,146,0.18)] dark:border-primary/40 dark:from-primary/[0.18] dark:via-[#08131a] dark:to-[#08131a]'
                  : 'border-gray-200/80 bg-gradient-to-b from-white via-white to-gray-50/90 dark:border-white/10 dark:from-white/[0.05] dark:via-[#08131a] dark:to-white/[0.03]'
              }`}
            >
              <div className="mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="max-w-[15rem]">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{plan.summary}</p>
                  </div>
                  {plan.popular ? (
                    <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                      Most Popular
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 rounded-[28px] border border-gray-200/80 bg-white/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    Monthly Price
                  </p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-[2.9rem] font-bold leading-none tracking-[-0.06em] text-gray-900 dark:text-gray-100 sm:text-[3.4rem]">${price}</span>
                    <span className="pb-2 text-sm font-medium text-gray-500 dark:text-gray-400">/month</span>
                  </div>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  {key === 'STARTER' ? 'Core workflow' : 'AI receptionist included'}
                </p>
              </div>
              <ul className="mb-6 grid flex-1 gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 px-1 py-2 text-sm text-gray-600 dark:text-gray-300">
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
