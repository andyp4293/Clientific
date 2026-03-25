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

        <div className="mx-auto mb-6 max-w-4xl rounded-[28px] border border-primary/15 bg-primary/[0.06] px-5 py-4 text-left text-sm leading-6 text-gray-700 dark:border-primary/20 dark:bg-primary/[0.08] dark:text-gray-200">
          Starter includes booking, CRM, deals, referrals, and payouts. Pro and Premium add the
          AI receptionist experience on top of that core workflow.
        </div>

        <div className="grid max-w-6xl mx-auto gap-6 lg:grid-cols-3">
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
                className={`card p-8 relative flex flex-col ${
                  plan.popular ? 'border-2 border-primary shadow-xl shadow-primary/10' : ''
                } rounded-[28px] p-6 sm:p-8`}
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                        plan.popular
                          ? 'bg-primary text-white'
                          : 'border border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200'
                      }`}
                    >
                      {plan.popular ? 'Most Popular' : 'Special Pricing'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{plan.summary}</p>
                  <div className="mt-5 overflow-hidden rounded-[26px] border border-gray-200/80 bg-gradient-to-br from-white via-gray-50/95 to-primary/[0.05] p-4 dark:border-white/10 dark:from-white/[0.06] dark:via-white/[0.04] dark:to-primary/[0.12] sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                          Regularly
                        </p>
                        <div className="mt-1 text-base font-semibold text-gray-400 line-through decoration-2 dark:text-gray-500 sm:text-lg">
                          ${plan.compareAtPrice}/month
                        </div>
                      </div>
                      <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-sm shadow-primary/30">
                        Today
                      </span>
                    </div>
                    <div className="mt-4 flex items-end gap-2 sm:gap-3">
                      <span className="text-[2.8rem] font-bold leading-none tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                        ${plan.price}
                      </span>
                      <span className="pb-1 text-sm font-medium text-gray-600 dark:text-gray-300 sm:text-base">
                        /month
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-primary dark:text-primary-200">
                      Launch pricing active now
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900/30 dark:bg-emerald-900/20">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                        You Save
                      </p>
                      <p className="mt-1 font-semibold text-emerald-900 dark:text-emerald-100">
                        ${monthlySavings}/month
                      </p>
                    </div>
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm dark:border-primary/30 dark:bg-primary/15">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary dark:text-primary-200">
                        Discount
                      </p>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                        {discountPercent}% off
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-primary dark:text-primary-200">
                    That is ${yearlySavings}/year below the regular monthly rate.
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    {key === 'STARTER' ? 'Core workflow' : 'AI receptionist included'}
                  </p>
                  <div className="mt-4 rounded-2xl border border-gray-200/80 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                    {key === 'STARTER'
                      ? 'Booking, CRM, marketing, referrals, and payouts are included here.'
                      : 'Includes the full core workflow plus AI receptionist phone coverage.'}
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-success mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => void handleSubscribe(publicSlug)}
                  disabled={isLoading}
                  className="block w-full text-center py-3.5 px-4 rounded-xl font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-700"
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
