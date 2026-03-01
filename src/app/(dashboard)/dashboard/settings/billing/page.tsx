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

interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding: string;
}

interface Invoice {
  id: string;
  number: string | null;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string | null;
  created: number;
  periodStart: number;
  periodEnd: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  description: string | null;
}

function cardBrandLabel(brand: string) {
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    open: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    void: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    uncollectible: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${map[status] ?? map.draft}`}>
      {status}
    </span>
  );
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    past_due: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    canceled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    incomplete: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  const label: Record<string, string> = {
    active: 'Active',
    trialing: 'Free Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? map.active}`}>
      {label[status] ?? status}
    </span>
  );
}

export default function BillingPage() {
  useSession();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/subscription').then(r => r.ok ? r.json() : null),
      fetch('/api/billing/details').then(r => r.ok ? r.json() : null),
    ]).then(([sub, details]) => {
      if (sub) setSubscription(sub);
      if (details) {
        setPaymentMethod(details.paymentMethod ?? null);
        setInvoices(details.invoices ?? []);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Failed to open billing portal. Please try again.');
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="h-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  const plan = subscription?.subscriptionPlan?.toUpperCase() as keyof typeof PRICING_PLANS;
  const planDetails = PRICING_PLANS[plan] || PRICING_PLANS.STARTER;
  const isTrial = subscription?.subscriptionStatus === 'trialing';

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your subscription, payment method, and invoices.
        </p>
      </div>

      {/* Trial banner */}
      {isTrial && subscription.trialDaysRemaining !== null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10 p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {subscription.trialDaysRemaining === 0
                ? 'Your free trial ends today.'
                : `${subscription.trialDaysRemaining} day${subscription.trialDaysRemaining === 1 ? '' : 's'} left in your free trial.`}
              {subscription.trialEndsAt && (
                <> Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</>
              )}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Add a payment method to keep access after your trial ends.
            </p>
          </div>
          <Link href="/pricing" className="flex-shrink-0 text-sm font-semibold text-amber-800 dark:text-amber-300 hover:underline">
            Choose a plan →
          </Link>
        </div>
      )}

      {/* Subscription card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Current Plan
            </p>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{planDetails.name}</span>
              {subscription?.subscriptionStatus && (
                <SubscriptionStatusBadge status={subscription.subscriptionStatus} />
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">${planDetails.price}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
            </div>
            {subscription?.stripeCurrentPeriodEnd && !isTrial && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Renews {new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
            {isTrial && subscription?.trialEndsAt && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="btn-primary text-sm"
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
            <Link href="/pricing" className="btn-outline text-sm text-center">
              View All Plans
            </Link>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">What&apos;s included</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {planDetails.features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Payment Method
            </p>
            {paymentMethod ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-8 rounded-md bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800 flex items-center justify-center flex-shrink-0 shadow">
                  <svg className="w-7 h-4 text-white opacity-70" viewBox="0 0 48 32" fill="currentColor">
                    <rect x="4" y="20" width="10" height="4" rx="1" fill="currentColor" opacity="0.6"/>
                    <rect x="17" y="20" width="10" height="4" rx="1" fill="currentColor" opacity="0.6"/>
                    <rect x="30" y="20" width="10" height="4" rx="1" fill="currentColor" opacity="0.6"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {cardBrandLabel(paymentMethod.brand)} ···· {paymentMethod.last4}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                    {paymentMethod.funding && ` · ${paymentMethod.funding} card`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-12 h-8 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">No payment method on file</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add one to continue after your trial</p>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="btn-outline text-sm flex-shrink-0"
          >
            {paymentMethod ? 'Update' : 'Add Card'}
          </button>
        </div>
      </div>

      {/* Invoice history */}
      <div className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
          Invoice History
        </p>

        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left pb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-3 pr-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {inv.number ?? inv.id.slice(-8).toUpperCase()}
                      </p>
                      {inv.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[180px]">
                          {inv.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(inv.created)}
                    </td>
                    <td className="py-3 pr-4 text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {formatCurrency(inv.amountPaid || inv.amountDue, inv.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      {inv.status && <InvoiceStatusBadge status={inv.status} />}
                    </td>
                    <td className="py-3 text-right">
                      {(inv.invoicePdf || inv.hostedInvoiceUrl) && (
                        <a
                          href={inv.invoicePdf ?? inv.hostedInvoiceUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Download PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel */}
      <div className="card p-6 border border-red-200 dark:border-red-900/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
          Cancel Subscription
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          You can cancel at any time. You&apos;ll retain access until the end of your billing period.
        </p>
        <button
          onClick={openPortal}
          disabled={portalLoading}
          className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
        >
          Cancel subscription →
        </button>
      </div>
    </div>
  );
}
