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
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/billing/subscription');
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  };

  // Don't show if dismissed or not on trial
  if (dismissed || !subscription || subscription.subscriptionStatus !== 'trialing') {
    return null;
  }

  // Show urgent warning if 3 days or less remaining
  const isUrgent = subscription.trialDaysRemaining !== null && subscription.trialDaysRemaining <= 3;

  return (
    <div className={`${isUrgent ? 'bg-orange-50 dark:bg-orange-950/55 border-orange-200 dark:border-orange-800/70' : 'bg-primary-50 dark:bg-primary-950/55 border-primary-200 dark:border-primary-900'} border-b px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <svg 
            className={`w-5 h-5 ${isUrgent ? 'text-orange-600 dark:text-orange-200' : 'text-primary-700 dark:text-gray-50'} mr-2`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={`text-sm ${isUrgent ? 'text-orange-900 dark:text-orange-50' : 'text-primary-900 dark:text-gray-50'}`}>
            {subscription.trialDaysRemaining !== null && (
              <>
                <strong>{subscription.trialDaysRemaining} days</strong> left in your free trial.{' '}
              </>
            )}
            <Link href="/pricing" className="underline font-medium">
              Choose a plan
            </Link>{' '}
            to continue after your trial ends.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className={`${isUrgent ? 'text-orange-600 dark:text-orange-100 hover:text-orange-800 dark:hover:text-orange-50' : 'text-primary-700 dark:text-gray-50 hover:text-primary-900 dark:hover:text-white'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
