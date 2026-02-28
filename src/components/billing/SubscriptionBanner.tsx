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
    <div className={`${isUrgent ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'} border-b px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <svg 
            className={`w-5 h-5 ${isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'} mr-2`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={`text-sm ${isUrgent ? 'text-orange-900 dark:text-orange-100' : 'text-blue-900 dark:text-blue-100'}`}>
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
          className={`${isUrgent ? 'text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300' : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
