'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PRICING_PLANS } from '@/lib/stripe';
import { APP_SUPPORT_EMAIL } from '@/lib/brand';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

function PricingContent() {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Auto-trigger checkout when coming from registration with a selected plan
  useEffect(() => {
    const autostart = searchParams.get('autostart');
    if (!autostart || status !== 'authenticated') return;

    const planKey = autostart.toUpperCase() as keyof typeof PRICING_PLANS;
    const plan = PRICING_PLANS[planKey];
    if (plan) {
      handleSubscribe(planKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, searchParams]);

  const handleSubscribe = async (planKey: string) => {
    if (!isAuthenticated) {
      router.push(`/register?plan=${planKey.toLowerCase()}`);
      return;
    }

    setLoadingPlan(planKey);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey.toLowerCase(), billingPeriod }),
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <PublicSiteHeader
        active="pricing"
        ctaLabel={isAuthenticated ? 'Dashboard' : 'Start Free Trial'}
        ctaHref={isAuthenticated ? '/dashboard' : '/register'}
        showLogin={!isAuthenticated}
      />

      {/* Pricing Section */}
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8">
            Choose the plan that&apos;s right for your business. Start with a 14-day free trial.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4">
            <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                billingPeriod === 'yearly' ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingPeriod === 'yearly' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              Yearly
              <span className="ml-1 text-xs text-success font-semibold">(Save 20%)</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {Object.entries(PRICING_PLANS).map(([key, plan]) => {
            const isLoading = loadingPlan === key;
            const displayPrice = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.price;

            return (
              <div
                key={key}
                className={`card p-8 relative flex flex-col ${
                  plan.popular ? 'border-2 border-primary shadow-xl' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center mb-1">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">${displayPrice}</span>
                    <span className="text-gray-600 dark:text-gray-300 ml-2">/month</span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Billed ${displayPrice * 12}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-success mr-2 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
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
                  onClick={() => handleSubscribe(key)}
                  disabled={isLoading}
                  className={`block w-full text-center py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    plan.popular
                      ? 'bg-primary text-white hover:bg-primary-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
                  }`}
                >
                  {isLoading
                    ? 'Redirecting...'
                    : isAuthenticated
                    ? 'Subscribe — 14-day free trial'
                    : 'Start Free Trial'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            All plans include a 14-day free trial. No credit card required to start.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need a custom plan?{' '}
            <a href={`mailto:${APP_SUPPORT_EMAIL}`} className="text-primary hover:underline">
              Contact sales
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
