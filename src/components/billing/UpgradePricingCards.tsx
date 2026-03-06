'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    yearlyPrice: 23,
    features: [
      'Up to 100 customers',
      'Basic check-in system',
      'Email & SMS notifications',
      'Basic analytics',
    ],
    popular: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 79,
    yearlyPrice: 63,
    features: [
      'Up to 1,000 customers',
      'Advanced check-in & kiosk mode',
      'Online booking page',
      'Loyalty rewards program',
      'Marketing campaigns',
      'Advanced analytics',
      'Priority support',
    ],
    popular: true,
  },
  {
    key: 'premium',
    name: 'Premium',
    price: 149,
    yearlyPrice: 119,
    features: [
      'Unlimited customers',
      'Everything in Pro',
      'Custom branding',
      'API access',
      'Dedicated account manager',
      'White-label option',
    ],
    popular: false,
  },
];

interface Props {
  status: string;
  hasStripeCustomer: boolean;
}

export function UpgradePricingCards({ status, hasStripeCustomer }: Props) {
  const router = useRouter();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleUpgrade(planKey: string) {
    setLoading(planKey);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, billingPeriod: billing }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
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
    <div className="mt-8 w-full max-w-5xl mx-auto">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>Monthly</span>
        <button
          onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
          className={`relative w-11 h-6 rounded-full transition-colors ${billing === 'yearly' ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${billing === 'yearly' ? 'translate-x-5' : ''}`} />
        </button>
        <span className={`text-sm font-medium ${billing === 'yearly' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
          Yearly <span className="text-emerald-500 text-xs font-semibold ml-1">Save 20%</span>
        </span>
      </div>

      {/* Pricing cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map(plan => {
          const price = billing === 'yearly' ? plan.yearlyPrice : plan.price;
          const isLoading = loading === plan.key;
          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.popular
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">${price}</span>
                  <span className="text-gray-400 text-sm mb-1">/mo{billing === 'yearly' ? ', billed yearly' : ''}</span>
                </div>
              </div>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={isLoading}
                className={plan.popular ? 'btn-primary w-full' : 'btn-outline w-full'}
              >
                {isLoading ? 'Redirecting...' : 'Get Started'}
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
