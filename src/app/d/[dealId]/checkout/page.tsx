'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useMemo, useState, useEffect } from 'react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface DealService {
  id: string;
  name: string;
  price: number | null;
  duration: number;
}

interface DealResponse {
  deal: {
    id: string;
    title: string;
    description: string | null;
    deliveryType: string;
    serviceScope: string;
    discountType: string;
    discountValue: number;
    startsAt: string;
    expiresAt: string;
    selectableServices: DealService[];
    business: {
      name: string;
      slug: string;
      publicId: string;
      city: string | null;
      state: string | null;
    };
  };
}

function fmt(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'Price set in-store';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function discountLabel(type: string, value: number): string {
  if (type === 'percent_off') return `${value}% off`;
  if (type === 'amount_off') return `$${value.toFixed(2)} off`;
  return 'Free service';
}

function calculateTotals(discountType: string, discountValue: number, services: DealService[]) {
  const subtotal = services.reduce((sum, s) => sum + (s.price ?? 0), 0);
  if (discountType === 'free_service') return { subtotal, discount: subtotal, total: 0 };
  if (discountType === 'percent_off') {
    const total = Math.max(0, subtotal * (1 - discountValue / 100));
    return { subtotal, discount: subtotal - total, total };
  }
  const discount = Math.min(subtotal, discountValue);
  return { subtotal, discount, total: subtotal - discount };
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

// ─── Payment form (inside Elements) ─────────────────────────────────────────

interface PaymentFormProps {
  purchaseToken: string;
  totalAmount: number;
}

function PaymentForm({ purchaseToken, totalAmount }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/deal-purchases/${purchaseToken}`,
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? 'Payment failed. Please try again.');
      setIsSubmitting(false);
      return;
    }

    router.push(`/deal-purchases/${purchaseToken}`);
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto' },
        }}
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Pay {fmt(totalAmount)}
          </>
        )}
      </button>

      {/* Card brand logos */}
      <div className="flex items-center justify-center gap-3 opacity-60">
        <span className="text-xs text-gray-400 dark:text-gray-500">Accepted:</span>
        {['VISA', 'MC', 'AMEX', 'DISC'].map((brand) => (
          <span key={brand} className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            {brand}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DealCheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dealId = params.dealId as string;

  const serviceParam = searchParams.get('services');
  const selectedServiceIds = useMemo(
    () => (serviceParam ? serviceParam.split(',').filter(Boolean) : []),
    [serviceParam]
  );

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [contactLocked, setContactLocked] = useState(false);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [purchaseToken, setPurchaseToken] = useState<string | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Detect dark mode to set appropriate Stripe appearance
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const { data, isLoading, isError } = useQuery<DealResponse>({
    queryKey: ['public-deal', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/public/deals/${dealId}`);
      if (!res.ok) throw new Error('Deal not found');
      return res.json();
    },
    enabled: !!dealId,
  });

  const deal = data?.deal;
  const selectedServices = useMemo(
    () => (deal?.selectableServices ?? []).filter((s) => selectedServiceIds.includes(s.id)),
    [deal?.selectableServices, selectedServiceIds]
  );
  const totals = useMemo(
    () => calculateTotals(deal?.discountType ?? 'percent_off', deal?.discountValue ?? 0, selectedServices),
    [deal?.discountType, deal?.discountValue, selectedServices]
  );
  const expiresInDays = deal ? daysUntil(deal.expiresAt) : 0;

  const nameReady = customerName.trim().length > 0;
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
  const phoneReady = customerPhone.replace(/\D/g, '').length >= 10;
  const contactReady = nameReady && emailReady && phoneReady;

  // Auto-load payment intent as soon as all contact fields are valid
  useEffect(() => {
    if (!contactReady || contactLocked || clientSecret || isLoadingPayment) return;
    handleLoadPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactReady, contactLocked, clientSecret, isLoadingPayment]);

  function handleEditContact() {
    setContactLocked(false);
    setClientSecret(null);
    setPurchaseToken(null);
    setLoadError(null);
  }

  async function handleLoadPayment() {
    setIsLoadingPayment(true);
    setLoadError(null);

    try {
      const res = await fetch(`/api/public/deals/${dealId}/payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone,
          selectedServiceIds,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not start checkout');

      if (body.immediate) {
        router.push(body.url);
        return;
      }

      setClientSecret(body.clientSecret);
      setPurchaseToken(body.purchaseToken);
      setContactLocked(true);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not start checkout');
    } finally {
      setIsLoadingPayment(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (isError || !deal || deal.deliveryType !== 'purchase_link') {
    return (
      <div className="page-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">Deal unavailable</h1>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">This deal is no longer available for purchase.</p>
          <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            Browse active deals &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const stripeAppearance = {
    theme: (isDark ? 'night' : 'stripe') as 'night' | 'stripe',
    variables: {
      colorPrimary: '#7B22D4',
      colorBackground: isDark ? '#1f2937' : '#ffffff',
      colorText: isDark ? '#f3f4f6' : '#111827',
      colorDanger: '#ef4444',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      borderRadius: '10px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        border: isDark ? '1px solid #374151' : '1px solid #d1d5db',
        boxShadow: 'none',
        padding: '12px 16px',
        fontSize: '15px',
      },
      '.Input:focus': {
        border: '1px solid #7B22D4',
        boxShadow: '0 0 0 3px rgba(123,34,212,0.12)',
      },
      '.Tab': {
        border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
        borderRadius: '10px',
      },
      '.Tab--selected': {
        border: '1px solid #7B22D4',
        boxShadow: '0 0 0 2px rgba(123,34,212,0.2)',
      },
    },
  };

  return (
    <div className="page-shell min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <Link href={`/d/${dealId}`} className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Clientific
          </Link>
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secure Checkout
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-20 lg:py-8 lg:pb-8">
        <div className="grid gap-5 lg:grid-cols-[1fr,380px]">

          {/* ── Left: Contact + Payment ──────────────────────────────────── */}
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">

              {/* ── Contact information ── */}
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Contact information</h2>
                  </div>
                  {contactLocked && (
                    <button
                      type="button"
                      onClick={handleEditContact}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {contactLocked ? (
                  <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{customerName}</p>
                      <p className="text-gray-500 dark:text-gray-400">{customerEmail}</p>
                      <p className="text-gray-500 dark:text-gray-400">{customerPhone}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="checkout-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Full name
                      </label>
                      <input
                        id="checkout-name"
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Jane Doe"
                        autoComplete="name"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="checkout-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email address
                      </label>
                      <input
                        id="checkout-email"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="jane@example.com"
                        autoComplete="email"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="checkout-phone" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Mobile phone
                      </label>
                      <input
                        id="checkout-phone"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        autoComplete="tel"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                        Your redemption code will be texted here after payment.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-gray-100 dark:border-gray-800" />

              {/* ── Payment ── */}
              <div className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Payment</h2>
                </div>

                {clientSecret && purchaseToken ? (
                  <Elements
                    stripe={stripePromise}
                    options={{ clientSecret, appearance: stripeAppearance }}
                  >
                    <PaymentForm purchaseToken={purchaseToken} totalAmount={totals.total} />
                  </Elements>
                ) : isLoadingPayment ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Setting up payment...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loadError ? (
                      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
                          <button
                            type="button"
                            onClick={handleLoadPayment}
                            className="mt-1.5 text-xs font-semibold text-red-600 underline dark:text-red-400"
                          >
                            Try again
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 dark:border-gray-700 dark:bg-gray-800/40">
                        <svg className="h-6 w-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          Payment form loads automatically
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Bottom reassurance row */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                256-bit SSL encryption
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Powered by Stripe
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <svg className="h-3.5 w-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                Receipt emailed
              </span>
            </div>
          </div>

          {/* ── Right: Order summary ─────────────────────────────────────── */}
          <aside className="order-1 lg:order-2">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:sticky lg:top-6">

              {/* Savings banner */}
              {totals.discount > 0 && (
                <div className="rounded-t-2xl bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-3">
                  <p className="text-sm font-semibold text-white">
                    You save {fmt(totals.discount)} today!
                  </p>
                  <p className="text-xs text-green-100">
                    {discountLabel(deal.discountType, deal.discountValue)} applied automatically
                  </p>
                </div>
              )}

              <div className="p-5">
                {/* Deal info */}
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Order summary</p>
                <h2 className="mt-1.5 text-lg font-bold leading-snug text-gray-900 dark:text-gray-100">{deal.title}</h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{deal.business.name}</p>

                {/* Urgency */}
                {expiresInDays <= 7 && (
                  <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
                    <svg className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      Only {expiresInDays} day{expiresInDays !== 1 ? 's' : ''} left!
                    </p>
                  </div>
                )}

                {/* Services */}
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                  {selectedServices.length === 0 ? (
                    <p className="text-sm text-gray-400">No services selected.</p>
                  ) : (
                    selectedServices.map((service) => (
                      <div key={service.id} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{service.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{service.duration} min session</p>
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{fmt(service.price)}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Totals */}
                <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span>{fmt(totals.subtotal)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex items-center justify-between text-sm font-medium text-green-600 dark:text-green-400">
                      <span>Deal discount</span>
                      <span>-{fmt(totals.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 text-base font-bold text-gray-900 dark:text-gray-100">
                    <span>Total</span>
                    <span>{fmt(totals.total)}</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">No hidden fees</p>
                </div>

                {/* Expiry */}
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  Deal expires{' '}
                  {new Date(deal.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>

                {/* Guarantee */}
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-primary">Satisfaction guaranteed</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      If something goes wrong, contact us and we'll make it right.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
