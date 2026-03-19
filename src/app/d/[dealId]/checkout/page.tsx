'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useMemo, useState, useEffect } from 'react';
import { sanitizeStripeEnvValue } from '@/lib/stripe-env';

const stripePromise = loadStripe(sanitizeStripeEnvValue(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY));

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

// ─── Payment form (inside Elements — deferred intent) ─────────────────────────

interface PaymentFormProps {
  dealId: string;
  selectedServiceIds: string[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  canPay: boolean;
  totalAmount: number;
}

function PaymentForm({ dealId, selectedServiceIds, customerName, customerEmail, customerPhone, canPay, totalAmount }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements || !canPay) return;
    setIsSubmitting(true);
    setError(null);

    // Step 1: validate the Stripe element
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? 'Please check your payment details.');
      setIsSubmitting(false);
      return;
    }

    // Step 2: create payment intent on server
    let clientSecret: string;
    let purchaseToken: string;
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
      clientSecret = body.clientSecret;
      purchaseToken = body.purchaseToken;
    } catch (err: any) {
      setError(err?.message || 'Could not start checkout. Please try again.');
      setIsSubmitting(false);
      return;
    }

    // Step 3: confirm payment
    const result = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/deal-purchases/${purchaseToken}`,
        payment_method_data: {
          billing_details: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            phone: customerPhone,
          },
        },
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
    <div className="space-y-5">
      <div className="rounded-[24px] border border-gray-200 bg-white/75 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/70">
        <PaymentElement
          options={{
            layout: {
              type: 'accordion',
              defaultCollapsed: false,
              radios: true,
              spacedAccordionItems: false,
            },
            wallets: { applePay: 'auto', googlePay: 'auto' },
            fields: {
              billingDetails: {
                name: 'never',
                email: 'never',
                phone: 'never',
                address: 'auto',
              },
            },
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || !canPay || isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-white shadow-[0_24px_60px_-30px_rgba(15,138,99,0.65)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="flex flex-wrap items-center justify-center gap-2 opacity-70">
        <span className="text-xs text-gray-400 dark:text-gray-500">Accepted:</span>
        {['VISA', 'MC', 'AMEX', 'DISC'].map((brand) => (
          <span
            key={brand}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[9px] font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
          >
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
  const [isClaimingFree, setIsClaimingFree] = useState(false);
  const [freeClaimError, setFreeClaimError] = useState<string | null>(null);

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
  const isFree = totals.total === 0 && selectedServices.length > 0;
  const amountInCents = Math.round(totals.total * 100);

  const nameReady = customerName.trim().length > 0;
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
  const phoneReady = customerPhone.replace(/\D/g, '').length >= 10;
  const canPay = nameReady && emailReady && phoneReady;

  async function handleFreeClaim() {
    if (!canPay || isClaimingFree) return;
    setIsClaimingFree(true);
    setFreeClaimError(null);
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
      if (!res.ok) throw new Error(body.error || 'Could not claim deal');
      router.push(body.url ?? `/deal-purchases/${body.purchaseToken}`);
    } catch (err: any) {
      setFreeClaimError(err?.message || 'Could not claim deal. Please try again.');
    } finally {
      setIsClaimingFree(false);
    }
  }

  if (isLoading) {
    return (
      <div className="brand-shell flex min-h-screen items-center justify-center">
        <div className="brand-panel rounded-[28px] p-8 text-center">
          <div className="flex flex-col items-center gap-3">
          <svg className="h-6 w-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading checkout...</p>
        </div>
        </div>
      </div>
    );
  }

  if (isError || !deal || deal.deliveryType !== 'purchase_link') {
    return (
      <div className="brand-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="brand-panel w-full max-w-md rounded-[28px] p-8 text-center">
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
      colorPrimary: '#0F8A63',
      colorBackground: isDark ? '#13212A' : '#FFFFFF',
      colorText: isDark ? '#F3F8F7' : '#111827',
      colorDanger: '#DC2626',
      colorBorder: isDark ? '#31505B' : '#D7E2E0',
      colorTextSecondary: isDark ? '#C6D6D3' : '#546A67',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      borderRadius: '16px',
      spacingUnit: '5px',
    },
    rules: {
      '.Input': {
        border: isDark ? '1px solid #31505B' : '1px solid #D7E2E0',
        boxShadow: 'none',
        padding: '14px 16px',
        fontSize: '15px',
      },
      '.Input:focus': {
        border: '1px solid #0F8A63',
        boxShadow: '0 0 0 4px rgba(15,138,99,0.14)',
      },
      '.Tab': {
        border: isDark ? '1px solid #31505B' : '1px solid #D7E2E0',
        borderRadius: '16px',
        backgroundColor: isDark ? '#13212A' : '#FFFFFF',
      },
      '.Tab--selected': {
        border: '1px solid #0F8A63',
        boxShadow: '0 0 0 3px rgba(15,138,99,0.14)',
      },
      '.Label': {
        fontWeight: '600',
      },
    },
  };

  return (
    <div className="brand-shell min-h-screen">
      <header className="border-b border-gray-200/70 bg-white/75 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href={`/d/${dealId}`} className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Clientific
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-sm font-semibold text-primary dark:border-primary/20 dark:bg-primary/12">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secure Checkout
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-20 lg:px-8 lg:pb-10">
        <section className="mb-6 grid gap-5 xl:grid-cols-[1.16fr,0.84fr]">
          <div className="relative overflow-hidden rounded-[32px] brand-hero p-6 text-white shadow-[0_36px_90px_-44px_rgba(6,17,24,0.7)] sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%)]" />
            <div className="relative space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                <span>{deal.business.name}</span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white">
                  {discountLabel(deal.discountType, deal.discountValue)}
                </span>
                {deal.business.city && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/85">
                    {deal.business.city}
                    {deal.business.state ? `, ${deal.business.state}` : ''}
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{deal.title}</h1>
                {deal.description && (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
                    {deal.description}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    Services
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {selectedServices.length === 0
                      ? 'Choose below'
                      : `${selectedServices.length} selected`}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    Due today
                  </p>
                  <p className="mt-2 text-lg font-semibold">{fmt(totals.total)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                    Deal ends
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {new Date(deal.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="brand-panel rounded-[32px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Premium checkout
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Pay once now, then redeem directly with the business.
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-gray-200 bg-white/75 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Contact details first
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Your receipt and redemption details are delivered right away.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/75 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Stripe-secured payment
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Apple Pay, Google Pay, and cards are supported automatically.
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/75 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/70">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Paid value never expires
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Promotional timing may end, but the amount you paid remains redeemable.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">

          {/* ── Left: Contact + Payment ──────────────────────────────────── */}
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-[30px] border border-gray-200 bg-white/88 shadow-[0_30px_90px_-54px_rgba(6,17,24,0.55)] backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/88">

              {/* ── Contact information ── */}
              <div className="p-6 sm:p-7">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Contact information</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      We&apos;ll send your redemption code and receipt here.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="checkout-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="checkout-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email address <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="jane@example.com"
                      autoComplete="email"
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="checkout-phone" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Mobile phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      autoComplete="tel"
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      We'll text your redemption code after payment.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-gray-100 dark:border-gray-800" />

              {/* ── Payment ── */}
              <div className="p-6 sm:p-7">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Payment</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Secure payment powered by Stripe.
                    </p>
                  </div>
                </div>

                {isFree ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-green-200 bg-[linear-gradient(135deg,rgba(15,138,99,0.12),rgba(15,138,99,0.03))] px-5 py-4 dark:border-green-800/40 dark:bg-green-900/20">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-600 text-white shadow-sm shadow-green-900/20">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.75-3.75a1 1 0 111.414-1.414l3.043 3.043 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                            This deal is ready to claim at no cost
                          </p>
                          <p className="mt-1 text-sm leading-6 text-green-700 dark:text-green-300">
                            No payment is required. Confirm your contact details and we&apos;ll
                            deliver the redemption details immediately after you claim it.
                          </p>
                        </div>
                      </div>
                    </div>
                    {freeClaimError && (
                      <div className="flex items-start gap-3 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-red-700 dark:text-red-300">{freeClaimError}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleFreeClaim}
                      disabled={!canPay || isClaimingFree}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-white shadow-[0_24px_60px_-30px_rgba(15,138,99,0.65)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isClaimingFree ? 'Claiming...' : 'Claim for free'}
                    </button>
                    {!canPay && (
                      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                        Fill in your contact info above to continue.
                      </p>
                    )}
                  </div>
                ) : amountInCents > 0 ? (
                  <Elements
                    stripe={stripePromise}
                    options={{ mode: 'payment', amount: amountInCents, currency: 'usd', appearance: stripeAppearance }}
                  >
                    <PaymentForm
                      dealId={dealId}
                      selectedServiceIds={selectedServiceIds}
                      customerName={customerName}
                      customerEmail={customerEmail}
                      customerPhone={customerPhone}
                      canPay={canPay}
                      totalAmount={totals.total}
                    />
                  </Elements>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <svg className="h-5 w-5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>

            </div>

            {/* Bottom reassurance row */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Protected checkout',
                  body: '256-bit SSL encryption and secure payment processing.',
                  icon: (
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  ),
                },
                {
                  title: 'Trusted payment rail',
                  body: 'Apple Pay, Google Pay, and cards via Stripe.',
                  icon: (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ),
                },
                {
                  title: 'Instant delivery',
                  body: 'Your receipt and redemption details arrive right away.',
                  icon: (
                    <>
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </>
                  ),
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-gray-200 bg-white/72 px-4 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/72"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/15">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        {item.icon}
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Order summary ─────────────────────────────────────── */}
          <aside className="order-1 lg:order-2">
            <div className="space-y-4 lg:sticky lg:top-6">
              <div className="overflow-hidden rounded-[30px] border border-gray-200 bg-white/88 shadow-[0_30px_90px_-54px_rgba(6,17,24,0.5)] backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/88">
                <div className="relative overflow-hidden border-b border-gray-100 bg-[linear-gradient(135deg,rgba(6,17,24,0.96),rgba(16,72,56,0.96))] px-5 py-5 text-white dark:border-gray-800">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_32%)]" />
                  <div className="relative">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                          Order summary
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-white">{deal.title}</h2>
                        <p className="mt-1 text-sm text-white/70">{deal.business.name}</p>
                      </div>
                      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
                        {selectedServices.length} service{selectedServices.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {totals.discount > 0 && (
                      <div className="mt-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                        Save {fmt(totals.discount)} with {discountLabel(deal.discountType, deal.discountValue)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  {expiresInDays <= 7 && (
                    <div className="mb-4 flex items-center gap-2 rounded-[20px] border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-800 dark:bg-amber-900/20">
                      <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Only {expiresInDays} day{expiresInDays !== 1 ? 's' : ''} left to buy this offer
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedServices.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        No services selected yet.
                      </div>
                    ) : (
                      selectedServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-start justify-between gap-3 rounded-[22px] border border-gray-200 bg-white/72 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/65"
                        >
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{service.name}</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{service.duration} min session</p>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{fmt(service.price)}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 rounded-[24px] border border-gray-200 bg-gray-50/80 px-4 py-4 dark:border-gray-700 dark:bg-gray-950/40">
                    <div className="space-y-2.5">
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
                      <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                        <span>Total due today</span>
                        <span>{fmt(totals.total)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
                        No hidden fees
                      </span>
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-300">
                        Paid value never expires
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-gray-400">
                    Deal expires{' '}
                    {new Date(deal.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="brand-panel rounded-[28px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  What happens next
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    'Pay securely with Stripe and receive an instant confirmation.',
                    'Get your redemption code by email and text.',
                    'Redeem directly with the business when you are ready.',
                  ].map((step, index) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                        {index + 1}
                      </div>
                      <p className="pt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
