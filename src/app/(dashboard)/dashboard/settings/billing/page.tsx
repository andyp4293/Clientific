'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PRICING_PLANS } from '@/lib/stripe';

interface SubscriptionInfo {
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  stripeCurrentPeriodEnd: string | null;
  trialDaysRemaining: number | null;
  isActive: boolean;
}

export default function BillingPage() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to open portal:', error);
      alert('Failed to open billing portal. Please try again.');
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const plan = subscription?.subscriptionPlan?.toUpperCase() as keyof typeof PRICING_PLANS;
  const planDetails = PRICING_PLANS[plan] || PRICING_PLANS.STARTER;

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Billing & Subscription</h1>

      {/* Trial Banner */}
      {subscription?.subscriptionStatus === 'trialing' && subscription.trialDaysRemaining !== null && (
        <div className="card bg-blue-50 border-blue-200 p-6 mb-6">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-600 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-1">
                You're on a free trial
              </h3>
              <p className="text-blue-700">
                You have {subscription.trialDaysRemaining} days left in your trial.
                {subscription.trialEndsAt && (
                  <> Your trial ends on {new Date(subscription.trialEndsAt).toLocaleDateString()}.</>
                )}
              </p>
              <Link href="/pricing" className="btn-primary mt-3 inline-block">
                Choose a Plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
        
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {planDetails.name}
            </h3>
            <p className="text-3xl font-bold text-primary mb-4">
              ${planDetails.price}
              <span className="text-base text-gray-600 font-normal">/month</span>
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm">
                <span className="text-gray-600">Status:</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  subscription?.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {subscription?.subscriptionStatus}
                </span>
              </div>
              
              {subscription?.stripeCurrentPeriodEnd && (
                <div className="flex items-center text-sm text-gray-600">
                  <span>Next billing date:</span>
                  <span className="ml-2 font-medium">
                    {new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <ul className="space-y-2">
              {planDetails.features.slice(0, 5).map((feature, index) => (
                <li key={index} className="flex items-start text-sm text-gray-700">
                  <svg className="w-4 h-4 text-success mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="btn-primary w-full"
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
            <Link href="/pricing" className="btn-outline block text-center">
              View All Plans
            </Link>
          </div>
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Compare Plans</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Feature</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-900">Starter</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-900">Pro</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-900">Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-3 px-4 text-sm text-gray-700">Customers</td>
                <td className="text-center py-3 px-4 text-sm">Up to 100</td>
                <td className="text-center py-3 px-4 text-sm">Up to 1,000</td>
                <td className="text-center py-3 px-4 text-sm">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-700">Staff Members</td>
                <td className="text-center py-3 px-4 text-sm">2</td>
                <td className="text-center py-3 px-4 text-sm">10</td>
                <td className="text-center py-3 px-4 text-sm">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-700">Services</td>
                <td className="text-center py-3 px-4 text-sm">10</td>
                <td className="text-center py-3 px-4 text-sm">50</td>
                <td className="text-center py-3 px-4 text-sm">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-700">Online Booking</td>
                <td className="text-center py-3 px-4 text-sm">—</td>
                <td className="text-center py-3 px-4 text-sm">✓</td>
                <td className="text-center py-3 px-4 text-sm">✓</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-700">Marketing Campaigns</td>
                <td className="text-center py-3 px-4 text-sm">—</td>
                <td className="text-center py-3 px-4 text-sm">✓</td>
                <td className="text-center py-3 px-4 text-sm">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
