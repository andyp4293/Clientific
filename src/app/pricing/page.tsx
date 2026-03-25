'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APP_SUPPORT_PATH } from '@/lib/brand';
import { getPublicPlanSlug, getPricingPlanKey } from '@/lib/plan-utils';
import { PRICING_PLANS, VISIBLE_SELF_SERVE_PLAN_KEYS } from '@/lib/pricing-plans';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

function PricingContent() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const lowestMonthlyPrice = Math.min(
    ...VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => PRICING_PLANS[key].price)
  );

  useEffect(() => {
    const autostart = searchParams.get('autostart');
    if (!autostart || status !== 'authenticated') return;

    const planKey = getPricingPlanKey(autostart);
    if (planKey) {
      void handleSubscribe(getPublicPlanSlug(planKey.toLowerCase()));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, searchParams]);

  async function handleSubscribe(planSlug: string) {
    if (!isAuthenticated) {
      router.push(`/register?plan=${planSlug}`);
      return;
    }

    setLoadingPlan(planSlug);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planSlug, billingPeriod: 'monthly' }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start checkout. Please try again.');
        setLoadingPlan(null);
      }
    } catch {
      alert('Something went wrong. Please try again.');
      setLoadingPlan(null);
    }
  }

  return (
    <div className="page-shell min-h-screen">
      <PublicSiteHeader
        active="pricing"
        ctaLabel={isAuthenticated ? 'Dashboard' : 'Start Free Trial'}
        ctaHref={isAuthenticated ? '/dashboard' : '/register'}
        showLogin={!isAuthenticated}
      />

      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Three launch plans
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8">
            Regularly priced up to $149/month. Today, launch pricing starts at ${lowestMonthlyPrice}/month
            with Starter for the core workflow and AI receptionist starting on Pro.
          </p>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 min-[520px]:grid-cols-3">
            {[
              '14-day free trial',
              'Cancel anytime',
              'Secure checkout powered by Stripe',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm font-medium text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900/75 dark:text-gray-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mb-8 max-w-5xl rounded-[32px] border border-primary/15 bg-gradient-to-r from-primary/[0.08] via-white to-white px-6 py-5 text-left text-sm leading-6 text-gray-700 shadow-sm dark:border-primary/20 dark:bg-gradient-to-r dark:from-primary/[0.14] dark:via-white/[0.04] dark:to-white/[0.02] dark:text-gray-200 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary dark:text-primary-200">
                Launch Access
              </p>
              <p className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                Starter includes booking, CRM, deals, referrals, and payouts. Pro and Premium add
                AI receptionist coverage on top of that core workflow.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.05]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  Trial
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  14 days free
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.05]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  Billing
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Monthly, cancel anytime
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-[1400px] gap-6 xl:grid-cols-3">
          {VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => {
            const plan = PRICING_PLANS[key];
            const publicSlug = getPublicPlanSlug(key.toLowerCase());
            const isLoading = loadingPlan === publicSlug;
            const monthlySavings = plan.compareAtPrice - plan.price;
            const yearlySavings = monthlySavings * 12;
            const discountPercent = Math.round((monthlySavings / plan.compareAtPrice) * 100);

            return (
              <div
                key={key}
                data-testid="pricing-plan-card"
                className={`relative flex h-full flex-col overflow-hidden rounded-[32px] border p-6 shadow-[0_18px_60px_rgba(6,17,24,0.08)] transition-transform sm:p-8 ${
                  plan.popular
                    ? 'border-primary/30 bg-gradient-to-b from-primary/[0.12] via-white to-white shadow-[0_24px_80px_rgba(15,190,146,0.18)] dark:border-primary/40 dark:from-primary/[0.18] dark:via-[#08131a] dark:to-[#08131a]'
                    : 'border-gray-200/80 bg-gradient-to-b from-white via-white to-gray-50/90 dark:border-white/10 dark:from-white/[0.05] dark:via-[#08131a] dark:to-white/[0.03]'
                }`}
              >
                <div className="mb-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="max-w-[15rem]">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{plan.summary}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                        plan.popular
                          ? 'bg-primary text-white'
                          : 'border border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200'
                      }`}
                    >
                      {plan.popular ? 'Most Popular' : 'Special Pricing'}
                    </span>
                  </div>
                  <div className="mt-6 rounded-[30px] border border-gray-200/80 bg-white/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                          Launch Price
                        </p>
                        <div className="mt-2 flex items-end gap-2">
                          <span className="text-[3.4rem] font-bold leading-none tracking-[-0.06em] text-gray-900 dark:text-white sm:text-[4.2rem]">
                            ${plan.price}
                          </span>
                          <span className="pb-2 text-base font-medium text-gray-600 dark:text-gray-300">
                            /month
                          </span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-right dark:border-primary/30 dark:bg-primary/15">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary dark:text-primary-200">
                          Today
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {discountPercent}% off
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-gray-200/80 bg-gray-50/90 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                          Regularly
                        </p>
                        <p className="mt-1 text-base font-semibold text-gray-400 line-through decoration-2 dark:text-gray-500">
                          ${plan.compareAtPrice}/mo
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/30 dark:bg-emerald-900/20">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                          Save
                        </p>
                        <p className="mt-1 text-base font-semibold text-emerald-900 dark:text-emerald-100">
                          ${monthlySavings}/mo
                        </p>
                      </div>
                      <div className="rounded-2xl border border-primary/20 bg-primary/[0.08] px-4 py-3 dark:border-primary/30 dark:bg-primary/[0.12]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary dark:text-primary-200">
                          Annual Delta
                        </p>
                        <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                          ${yearlySavings}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-3 dark:border-primary/20 dark:bg-primary/[0.08]">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Launch pricing active now
                      </p>
                      <p className="text-sm font-semibold text-primary dark:text-primary-200">
                        ${yearlySavings}/year below regular
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-gray-200/80 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                      {key === 'STARTER' ? 'Core Workflow' : 'AI Receptionist Included'}
                    </p>
                    <p className="mt-2">
                      {key === 'STARTER'
                        ? 'Booking, CRM, marketing, referrals, and payouts are included here.'
                        : 'Includes the full core workflow plus AI receptionist phone coverage.'}
                    </p>
                  </div>
                </div>

                <ul className="mb-8 grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start rounded-2xl border border-gray-200/70 bg-white/70 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
                      <svg className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm leading-6 text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => void handleSubscribe(publicSlug)}
                  disabled={isLoading}
                  className="block w-full rounded-2xl bg-primary px-4 py-4 text-center font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading
                    ? 'Redirecting...'
                    : isAuthenticated
                      ? `Choose ${plan.name}`
                      : `Start ${plan.name} trial`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Includes a 14-day free trial. No credit card required to start.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Questions about which plan fits best?{' '}
            <Link href={APP_SUPPORT_PATH} className="text-primary hover:underline">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PricingContent />
    </Suspense>
  );
}
