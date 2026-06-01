'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PRICING_PLANS } from '@/lib/pricing-plans';
import { getPricingPlanKey } from '@/lib/plan-utils';
import {
  getBillingInvoiceEmptyState,
  getBillingManagementSummary,
  getBillingManagementTitle,
  getBillingPaymentMethodSummary,
  normalizeBillingProvider,
} from '@/lib/billing-provider';
import { AUTO_RENEWAL_DISCLOSURE_TITLE } from '@/lib/auto-renewal-disclosure';

const APPLE_SUBSCRIPTION_HELP_URL = 'https://support.apple.com/118428';

interface SubscriptionInfo {
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  stripeCurrentPeriodEnd: string | null;
  trialDaysRemaining: number | null;
  isActive: boolean;
  billingProvider: string | null;
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
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? map.draft}`}
    >
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
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status] ?? map.active}`}
    >
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
      fetch('/api/billing/subscription').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/billing/details').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sub, details]) => {
        if (sub) setSubscription(sub);
        if (details) {
          setPaymentMethod(details.paymentMethod ?? null);
          setInvoices(details.invoices ?? []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-5xl space-y-6 pb-8">
        <div className="brand-panel rounded-[30px] p-6 sm:p-7">
          <div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-4 h-10 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="card h-72 animate-pulse rounded-[28px] bg-gray-200/70 dark:bg-gray-700/40" />
          <div className="card h-56 animate-pulse rounded-[28px] bg-gray-200/70 dark:bg-gray-700/40" />
        </div>
        <div className="card h-72 animate-pulse rounded-[28px] bg-gray-200/70 dark:bg-gray-700/40" />
      </div>
    );
  }

  const planKey = getPricingPlanKey(subscription?.subscriptionPlan);
  const planDetails = planKey ? PRICING_PLANS[planKey] : PRICING_PLANS.STARTER;
  const isTrial = subscription?.subscriptionStatus === 'trialing';
  const billingProvider = normalizeBillingProvider(subscription?.billingProvider);
  const isAppStoreManaged = billingProvider === 'app_store';
  const isWebManaged = billingProvider === 'stripe';
  const isUnsubscribed = billingProvider === 'none';
  const managementTitle = getBillingManagementTitle(billingProvider);
  const managementSummary = getBillingManagementSummary(billingProvider);
  const paymentMethodSummary = getBillingPaymentMethodSummary(
    billingProvider,
    paymentMethod
      ? `${cardBrandLabel(paymentMethod.brand)} ending in ${paymentMethod.last4}`
      : null,
  );
  const invoiceEmptyState = getBillingInvoiceEmptyState(billingProvider);
  const currentRenewalDisclosure = isWebManaged
    ? isTrial
      ? `At the end of your current free trial, Clientific automatically charges $${planDetails.price}/month plus applicable taxes until you cancel. Your subscription renews monthly unless canceled before the next billing date. You can cancel anytime in Billing; access continues until the end of the current paid period.`
      : `Clientific automatically charges $${planDetails.price}/month plus applicable taxes until you cancel. Your subscription renews monthly unless canceled before the next billing date. You can cancel anytime in Billing; access continues until the end of the current paid period.`
    : null;

  const openPortal = async () => {
    if (!isWebManaged) {
      toast.error(
        isAppStoreManaged
          ? 'This subscription is managed through Apple. Use your iPhone or iPad App Store subscription settings.'
          : 'No website subscription is active yet.',
      );
      return;
    }

    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to open billing portal.');
        setPortalLoading(false);
      }
    } catch {
      toast.error('Failed to open billing portal. Please try again.');
      setPortalLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-6 pb-8">
      <section className="brand-hero rounded-[30px] border border-gray-200/80 p-6 shadow-[0_32px_90px_-50px_rgba(16,72,56,0.22)] dark:border-white/10 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="brand-hero-kicker text-xs font-semibold uppercase tracking-[0.28em]">Billing</p>
            <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
              Subscription and billing details
            </h1>
            <p className="brand-hero-muted text-sm leading-6 sm:text-base">
              Review your plan, payment method, and invoice history from one place, and manage the subscription where you originally bought it.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[22rem]">
            <div className="brand-hero-card rounded-[22px] p-4">
              <p className="brand-hero-kicker text-xs font-semibold uppercase tracking-[0.22em]">Current status</p>
              <div className="mt-3">
                {subscription?.subscriptionStatus ? (
                  <SubscriptionStatusBadge status={subscription.subscriptionStatus} />
                ) : (
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Unavailable</span>
                )}
              </div>
            </div>
            <div className="brand-hero-card rounded-[22px] p-4">
              <p className="brand-hero-kicker text-xs font-semibold uppercase tracking-[0.22em]">Current plan</p>
              <p className="mt-3 text-lg font-semibold text-gray-950 dark:text-white">{planDetails.name}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">${planDetails.price}/month</p>
            </div>
          </div>
        </div>
      </section>

      {isTrial && subscription.trialDaysRemaining !== null ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/10">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {subscription.trialDaysRemaining === 0
                ? 'Your free trial ends today.'
                : `${subscription.trialDaysRemaining} day${subscription.trialDaysRemaining === 1 ? '' : 's'} left in your free trial.`}
              {subscription.trialEndsAt ? (
                <>
                  {' '}
                  Trial ends{' '}
                  {new Date(subscription.trialEndsAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  .
                </>
              ) : null}
            </p>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
              Add a payment method to keep access after your trial ends.
            </p>
          </div>
          <Link
            href="/pricing"
            className="flex-shrink-0 text-sm font-semibold text-amber-800 hover:underline dark:text-amber-300"
          >
            Choose a plan
          </Link>
        </div>
      ) : null}

      <div
        className={`rounded-2xl border p-4 sm:p-5 ${
          isAppStoreManaged
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
            : isWebManaged
              ? 'border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30'
              : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
        }`}
      >
        <p className="text-sm font-semibold text-gray-950 dark:text-white">{managementTitle}</p>
        <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">{managementSummary}</p>
        {isAppStoreManaged ? (
          <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
            Manage this subscription where you bought it. Clientific web billing does not control App Store renewals, cancellations, refunds, or payment details.
          </p>
        ) : null}
        {isWebManaged ? (
          <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
            This subscription started on the web, so plan changes and billing updates stay in Clientific on the web instead of the iPhone app.
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="card rounded-[28px] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Current Plan
              </p>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{planDetails.name}</span>
                {subscription?.subscriptionStatus ? (
                  <SubscriptionStatusBadge status={subscription.subscriptionStatus} />
                ) : null}
              </div>
              <div className="mb-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">${planDetails.price}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
              </div>
              {subscription?.stripeCurrentPeriodEnd && !isTrial ? (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Renews{' '}
                  {new Date(subscription.stripeCurrentPeriodEnd).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              ) : null}
              {isTrial && subscription?.trialEndsAt ? (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Trial ends{' '}
                  {new Date(subscription.trialEndsAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              ) : null}
              {currentRenewalDisclosure ? (
                <div
                  className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs leading-5 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
                  data-testid="current-auto-renewal-disclosure"
                >
                  <p className="font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    {AUTO_RENEWAL_DISCLOSURE_TITLE}
                  </p>
                  <p className="mt-1">{currentRenewalDisclosure}</p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-shrink-0 flex-col gap-2">
              {isWebManaged ? (
                <>
                  <button onClick={openPortal} disabled={portalLoading} className="btn-primary text-sm">
                    {portalLoading ? 'Loading...' : 'Manage Subscription'}
                  </button>
                  <Link href="/pricing" className="btn-outline text-center text-sm">
                    View All Plans
                  </Link>
                </>
              ) : null}
              {isAppStoreManaged ? (
                <a
                  href={APPLE_SUBSCRIPTION_HELP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-center text-sm"
                >
                  Manage Through Apple
                </a>
              ) : null}
              {isUnsubscribed ? (
                <>
                  <Link href="/pricing" className="btn-primary text-center text-sm">
                    View All Plans
                  </Link>
                  <p className="max-w-[18rem] text-xs leading-5 text-gray-500 dark:text-gray-400">
                    If this business started on iPhone, begin the App Store trial there. Website billing can be started from the pricing page.
                  </p>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-700">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              What&apos;s included
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {planDetails.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <svg className="h-4 w-4 flex-shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card rounded-[28px] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Payment Method
              </p>
              {isWebManaged && paymentMethod ? (
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-12 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-gray-700 to-gray-900 shadow dark:from-gray-600 dark:to-gray-800">
                    <svg className="h-4 w-7 text-white opacity-70" viewBox="0 0 48 32" fill="currentColor">
                      <rect x="4" y="20" width="10" height="4" rx="1" fill="currentColor" opacity="0.6" />
                      <rect x="17" y="20" width="10" height="4" rx="1" fill="currentColor" opacity="0.6" />
                      <rect x="30" y="20" width="10" height="4" rx="1" fill="currentColor" opacity="0.6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {cardBrandLabel(paymentMethod.brand)} ending in {paymentMethod.last4}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                      {paymentMethod.funding ? ` | ${paymentMethod.funding} card` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-12 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{paymentMethodSummary}</p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      {isWebManaged
                        ? 'Add one to continue after your trial'
                        : isAppStoreManaged
                          ? 'Use the App Store on your iPhone or iPad to update payment details.'
                          : 'Start a subscription first to add billing details.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {isWebManaged ? (
              <button onClick={openPortal} disabled={portalLoading} className="btn-outline flex-shrink-0 text-sm">
                {paymentMethod ? 'Update' : 'Add Card'}
              </button>
            ) : isAppStoreManaged ? (
              <a
                href={APPLE_SUBSCRIPTION_HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline flex-shrink-0 text-sm"
              >
                Apple Billing Help
              </a>
            ) : (
              <Link href="/pricing" className="btn-outline flex-shrink-0 text-sm">
                View Plans
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="card rounded-[28px] p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Invoice History
        </p>

        {invoices.length === 0 ? (
          <div className="py-8 text-center">
            <svg className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">{invoiceEmptyState}</p>
          </div>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Invoice</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Amount</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
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
                      {inv.description ? (
                        <p className="mt-0.5 max-w-[180px] truncate text-xs text-gray-500 dark:text-gray-400">
                          {inv.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(inv.created)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(inv.amountPaid || inv.amountDue, inv.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      {inv.status ? <InvoiceStatusBadge status={inv.status} /> : null}
                    </td>
                    <td className="py-3 text-right">
                      {inv.invoicePdf || inv.hostedInvoiceUrl ? (
                        <a
                          href={inv.invoicePdf ?? inv.hostedInvoiceUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Download PDF
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isWebManaged ? (
        <div className="card rounded-[28px] border border-red-200 p-6 dark:border-red-900/50">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Cancel Subscription
          </p>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            You can cancel at any time. You&apos;ll retain access until the end of your billing period.
          </p>
          <button
            onClick={openPortal}
            disabled={portalLoading}
            className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Cancel subscription
          </button>
        </div>
      ) : isAppStoreManaged ? (
        <div className="card rounded-[28px] border border-amber-200 p-6 dark:border-amber-900/50">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            App Store-managed subscription
          </p>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            To cancel or change this subscription, use the App Store subscription settings on the iPhone or iPad where you bought it.
          </p>
          <a
            href={APPLE_SUBSCRIPTION_HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
          >
            See Apple subscription help
          </a>
        </div>
      ) : null}
    </div>
  );
}
