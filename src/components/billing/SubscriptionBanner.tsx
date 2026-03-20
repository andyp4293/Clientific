'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SubscriptionInfo {
  subscriptionStatus: string;
  trialDaysRemaining: number | null;
  isActive: boolean;
}

export function SubscriptionBanner() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void fetchSubscription();
  }, []);

  async function fetchSubscription() {
    try {
      const res = await fetch('/api/billing/subscription');
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  }

  // Don't show if dismissed or not on trial
  if (dismissed || !subscription || subscription.subscriptionStatus !== 'trialing') {
    return null;
  }

  // Show urgent warning if 3 days or less remaining
  const isUrgent = subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 3;

  return (
    <div
      data-testid="layout-subscription-banner"
      className={`${isUrgent ? 'bg-orange-50 dark:bg-orange-950/55 border-orange-200 dark:border-orange-800/70' : 'bg-primary-50 dark:bg-primary-950/55 border-primary-200 dark:border-primary-900'} border-b px-4 py-3`}
    >
      <div className="relative mx-auto flex max-w-7xl items-start gap-3 pr-10 sm:items-center">
        <svg
          className={`mt-0.5 h-5 w-5 shrink-0 ${isUrgent ? 'text-orange-600 dark:text-orange-200' : 'text-primary-700 dark:text-gray-50'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-6 ${isUrgent ? 'text-orange-900 dark:text-orange-50' : 'text-primary-900 dark:text-gray-50'}`}>
            {subscription.trialDaysRemaining !== null && (
              <>
                <strong>{subscription.trialDaysRemaining} days</strong> left in your free trial.{' '}
              </>
            )}
            <Link href="/pricing" className="font-medium underline underline-offset-2">
              Choose a plan
            </Link>{' '}
            to continue after your trial ends.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss subscription banner"
          className={`absolute right-4 top-1/2 -translate-y-1/2 ${isUrgent ? 'text-orange-600 dark:text-orange-100 hover:text-orange-800 dark:hover:text-orange-50' : 'text-primary-700 dark:text-gray-50 hover:text-primary-900 dark:hover:text-white'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
