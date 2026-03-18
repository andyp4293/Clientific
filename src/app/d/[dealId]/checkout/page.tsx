'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useMemo, useState } from 'react';

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

function formatMoney(value: number | null | undefined): string {
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

// ─── Payment step ─────────────────────────────────────────────────────────────

interface PaymentStepProps {
  purchaseToken: string;
  totalAmount: number;
  onBack: () => void;
}

function PaymentStep({ purchaseToken, totalAmount, onBack }: PaymentStepProps) {
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
    <div className="space-y-5">
      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto' },
        }}
      />

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || isSubmitting}
        className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Processing...' : `Pay ${formatMoney(totalAmount)}`}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={isSubmitting}
        className="w-full text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        &larr; Edit contact info
      </button>
    </div>
  );
}

// ─── Main checkout page ───────────────────────────────────────────────────────

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

  const [phase, setPhase] = useState<'contact' | 'payment'>('contact');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [purchaseToken, setPurchaseToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const nameReady = customerName.trim().length > 0;
  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());
  const phoneReady = customerPhone.replace(/\D/g, '').length >= 10;
  const contactReady = nameReady && emailReady && phoneReady && !isSubmitting;

  async function handleContinueToPayment() {
    setIsSubmitting(true);
    setSubmitError(null);

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
      setPhase('payment');
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not start checkout');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading checkout...</p>
      </div>
    );
  }

  if (isError || !deal || deal.deliveryType !== 'purchase_link') {
    return (
      <div className="page-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800">
          <h1 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Checkout unavailable</h1>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">This deal is no longer available for purchase.</p>
          <Link href="/explore" className="text-sm font-medium text-primary hover:underline">Browse active deals</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-screen">
      {/* Minimal secure checkout header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href={`/d/${dealId}`} className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Clientific
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secure Checkout
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 pb-20 lg:pb-8">
        <div className="grid gap-6 lg:grid-cols-[1fr,420px]">

          {/* ── Left: Contact form / Payment ─────────────────────────────── */}
          <div className="order-2 lg:order-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              {phase === 'contact' ? (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Contact information</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      We'll send your redemption code and receipt here.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Full name
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Jane Doe"
                        autoComplete="name"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email address
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="jane@example.com"
                        autoComplete="email"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Mobile phone
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        autoComplete="tel"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        We'll text your redemption code after payment.
                      </p>
                    </div>
                  </div>

                  {submitError && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleContinueToPayment}
                    disabled={!contactReady}
                    className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? 'Setting up payment...' : 'Continue to Payment'}
                  </button>

                  <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                    Apple Pay, Google Pay, and all major cards accepted.
                  </p>
                </div>
              ) : (
                clientSecret && purchaseToken && (
                  <div className="space-y-5">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Payment</h1>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Pay securely with Apple Pay, Google Pay, or a card.
                      </p>
                    </div>
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: '#7B22D4',
                            borderRadius: '12px',
                            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                          },
                        },
                      }}
                    >
                      <PaymentStep
                        purchaseToken={purchaseToken}
                        totalAmount={totals.total}
                        onBack={() => {
                          setPhase('contact');
                          setClientSecret(null);
                          setPurchaseToken(null);
                        }}
                      />
                    </Elements>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── Right: Order summary ──────────────────────────────────────── */}
          <aside className="order-1 lg:order-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:sticky lg:top-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Order summary</p>
              <h2 className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">{deal.title}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{deal.business.name}</p>

              <div className="mt-1">
                <span className="inline-block rounded bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {discountLabel(deal.discountType, deal.discountValue)}
                </span>
              </div>

              <div className="mt-5 space-y-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                {selectedServices.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No services selected.</p>
                ) : (
                  selectedServices.map((service) => (
                    <div key={service.id} className="flex items-start justify-between gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{service.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{service.duration} min</p>
                      </div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{formatMoney(service.price)}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>{formatMoney(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-primary">
                  <span>Deal discount</span>
                  <span>-{formatMoney(totals.discount)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                  <span>Total</span>
                  <span>{formatMoney(totals.total)}</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                Expires{' '}
                {new Date(deal.expiresAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>

              {/* Trust badges */}
              <div className="mt-6 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <svg className="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  256-bit SSL encryption
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <svg className="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Secure payment powered by Stripe
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <svg className="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Receipt emailed after purchase
                </div>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
