'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APP_SUPPORT_EMAIL } from '@/lib/brand';
import { getPublicPlanSlug, getPricingPlanKey } from '@/lib/plan-utils';
import { PRICING_PLANS, VISIBLE_SELF_SERVE_PLAN_KEYS } from '@/lib/pricing-plans';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

function PricingContent() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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
            One Simple Monthly Plan
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8">
            Everything most service businesses need in one subscription. Start with a 14-day free trial.
          </p>
        </div>

        <div className="grid max-w-3xl mx-auto gap-6">
          {VISIBLE_SELF_SERVE_PLAN_KEYS.map((key) => {
            const plan = PRICING_PLANS[key];
            const publicSlug = getPublicPlanSlug(key.toLowerCase());
            const isLoading = loadingPlan === publicSlug;
            const displayPrice = plan.price;

            return (
              <div
                key={key}
                className={`card p-8 relative flex flex-col ${
                  plan.popular ? 'border-2 border-primary shadow-xl shadow-primary/10' : ''
                }`}
              >
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{plan.summary}</p>
                  <div className="flex items-baseline justify-center mb-1">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">${displayPrice}</span>
                    <span className="text-gray-600 dark:text-gray-300 ml-2">/month</span>
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
                  className="block w-full text-center py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-700"
                >
                  {isLoading
                    ? 'Redirecting...'
                    : isAuthenticated
                      ? 'Start 14-day free trial'
                      : 'Start Free Trial'}
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
            <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="text-primary hover:underline">
              Contact support
            </a>
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
