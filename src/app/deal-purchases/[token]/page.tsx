'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

interface DealPurchaseResponse {
  purchase: {
    id: string;
    token: string;
    status: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    applicationFeeAmount: number;
    businessNetAmount: number;
    stripeReceiptUrl: string | null;
    redemptionCode: string | null;
    purchasedAt: string | null;
    redeemedAt: string | null;
    expiresAt: string | null;
    deal: {
      id: string;
      title: string;
      description: string | null;
      discountType: string;
      discountValue: number;
    };
    business: {
      name: string;
      slug: string;
      publicId: string;
      city: string | null;
      state: string | null;
    };
    items: Array<{
      id: string;
      serviceName: string;
      quantity: number;
      originalUnitAmount: number;
      discountedUnitAmount: number;
    }>;
  };
}

function formatCents(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLongDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function DealPurchaseReceiptPage() {
  const params = useParams();
  const token = params.token as string;
  const { data: session } = useSession();

  const { data, isLoading, isError } = useQuery<DealPurchaseResponse>({
    queryKey: ['deal-purchase', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/deal-purchases/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Purchase not found');
      }
      return res.json();
    },
    enabled: !!token,
    retry: 6,
    retryDelay: (attempt) => Math.min(1000 * attempt, 4000),
  });

  if (isLoading) {
    return (
      <div className="brand-shell flex min-h-screen items-center justify-center px-4">
        <div className="brand-panel w-full max-w-md rounded-[28px] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/15">
            <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Confirming your purchase
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            We&apos;re pulling together your receipt, redemption code, and purchase details now.
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data?.purchase) {
    return (
      <div className="brand-shell flex min-h-screen items-center justify-center px-4">
        <div className="brand-panel w-full max-w-md rounded-[28px] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-900/30">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Receipt unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            We could not find that deal purchase. You can still browse active offers below.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Browse active deals
          </Link>
        </div>
      </div>
    );
  }

  const { purchase } = data;
  const purchasedAt = formatDateTime(purchase.purchasedAt);
  const redeemedAt = formatDateTime(purchase.redeemedAt);
  const promoEnd = formatLongDate(purchase.expiresAt);

  return (
    <div className="brand-shell min-h-screen">
      <header className="border-b border-gray-200/70 bg-white/75 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href={`/d/${purchase.deal.id}`} className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Clientific
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary dark:border-primary/20 dark:bg-primary/12">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Purchase Confirmed
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-20 lg:px-8 lg:pb-12">
        <div className="space-y-6">
          {session && (
            <Link
              href="/dashboard/campaigns"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <span aria-hidden="true">&larr;</span>
              Back to deals
            </Link>
          )}

          <section className="grid gap-5 xl:grid-cols-[1.14fr,0.86fr]">
            <div className="relative overflow-hidden rounded-[32px] brand-hero p-6 text-white shadow-[0_36px_90px_-44px_rgba(6,17,24,0.7)] sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%)]" />
              <div className="relative space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  <span>Deal receipt</span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white">
                    {formatStatusLabel(purchase.status)}
                  </span>
                  {purchase.business.city && (
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/85">
                      {purchase.business.city}
                      {purchase.business.state ? `, ${purchase.business.state}` : ''}
                    </span>
                  )}
                </div>

                <div>
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{purchase.deal.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
                    Purchased from {purchase.business.name}. Your paid value is secured and your
                    redemption details are ready below.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      Total paid
                    </p>
                    <p className="mt-2 text-lg font-semibold">{formatCents(purchase.totalAmount)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      Purchased
                    </p>
                    <p className="mt-2 text-lg font-semibold">{purchasedAt ?? 'Processing'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      Redemption code
                    </p>
                    <p className="mt-2 text-lg font-semibold">{purchase.redemptionCode ?? 'Processing'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="brand-panel rounded-[32px] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                What to do next
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Your receipt is locked in and ready to use.
              </h2>
              <div className="mt-5 space-y-3">
                {[
                  'Save your redemption code or keep this page handy when you visit the business.',
                  'Check your email and text messages for a copy of your purchase details.',
                  'Redeem the deal directly with the business whenever you are ready.',
                ].map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-[22px] border border-gray-200 bg-white/72 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/70">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{step}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {purchase.stripeReceiptUrl && (
                  <a
                    href={purchase.stripeReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
                  >
                    Open Stripe receipt
                  </a>
                )}
                <Link
                  href={`/business/${purchase.business.publicId}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 transition hover:border-primary hover:text-primary dark:border-gray-700 dark:text-gray-100"
                >
                  View business
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.02fr,0.98fr]">
            <div className="space-y-6">
              <div className="brand-panel rounded-[30px] p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-gray-200 bg-white/75 p-5 dark:border-gray-700 dark:bg-gray-900/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Customer
                    </p>
                    <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {purchase.customerName}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{purchase.customerPhone}</p>
                    {purchase.customerEmail && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{purchase.customerEmail}</p>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-gray-200 bg-white/75 p-5 dark:border-gray-700 dark:bg-gray-900/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Status
                    </p>
                    <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {formatStatusLabel(purchase.status)}
                    </p>
                    {purchasedAt && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Purchased {purchasedAt}
                      </p>
                    )}
                    {redeemedAt && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Redeemed {redeemedAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="brand-panel rounded-[30px] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Purchased services
                </p>
                <div className="mt-5 space-y-3">
                  {purchase.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-4 rounded-[24px] border border-gray-200 bg-white/75 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/70"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {item.serviceName}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Original {formatCents(item.originalUnitAmount)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCents(item.discountedUnitAmount)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Qty {item.quantity}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="brand-panel rounded-[30px] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Payment summary
                </p>
                <div className="mt-5 rounded-[26px] border border-gray-200 bg-white/75 p-5 dark:border-gray-700 dark:bg-gray-900/70">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>Subtotal</span>
                      <span>{formatCents(purchase.subtotalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-medium text-green-600 dark:text-green-400">
                      <span>Deal discount</span>
                      <span>-{formatCents(purchase.discountAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                      <span>Total paid</span>
                      <span>{formatCents(purchase.totalAmount)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
                      No hidden fees
                    </span>
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-300">
                      Paid value never expires
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-primary/15 bg-primary/5 px-5 py-4 dark:border-primary/20 dark:bg-primary/10">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">Your paid value never expires</p>
                      <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                        The {formatCents(purchase.totalAmount)} you paid will always be honored by{' '}
                        {purchase.business.name}.
                        {promoEnd
                          ? purchase.expiresAt && new Date(purchase.expiresAt) > new Date()
                            ? ` Promotional value valid through ${promoEnd}.`
                            : ' The promotional period has ended, but your paid value remains fully redeemable.'
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {purchase.customerEmail && (
                  <div className="mt-4 rounded-[24px] border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                    Receipt emailed to {purchase.customerEmail}
                  </div>
                )}
              </div>

              <div className="brand-panel rounded-[30px] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Keep exploring
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Link
                    href={`/business/${purchase.business.publicId}`}
                    className="rounded-[24px] border border-gray-200 bg-white/75 px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-primary hover:text-primary dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-100"
                  >
                    View {purchase.business.name}
                  </Link>
                  <Link
                    href={purchase.business.city ? `/explore?location=${encodeURIComponent(purchase.business.city)}` : '/explore'}
                    className="rounded-[24px] border border-gray-200 bg-white/75 px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-primary hover:text-primary dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-100"
                  >
                    Find more deals nearby
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
