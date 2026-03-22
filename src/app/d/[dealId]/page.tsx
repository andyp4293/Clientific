'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

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
    service: { name: string } | null;
    selectableServices: DealService[];
    business: {
      name: string;
      slug: string;
      publicId: string;
      city: string | null;
      state: string | null;
    };
    viewerCanManage: boolean;
  };
}

function discountLabel(type: string, value: number): string {
  if (type === 'percent_off') return `${value}% off`;
  if (type === 'amount_off') return `$${value.toFixed(2)} off`;
  return 'Free service';
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number') return 'Price set in-store';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function calculatePreviewTotals(
  discountType: string,
  discountValue: number,
  selectedServices: DealService[]
) {
  const subtotal = selectedServices.reduce((sum, service) => sum + (service.price ?? 0), 0);
  if (discountType === 'free_service') {
    return { subtotal, discount: subtotal, total: 0 };
  }
  if (discountType === 'percent_off') {
    const total = Math.max(0, subtotal * (1 - discountValue / 100));
    return { subtotal, discount: subtotal - total, total };
  }
  const discount = Math.min(subtotal, discountValue);
  return { subtotal, discount, total: subtotal - discount };
}

export default function PublicDealClaimPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.dealId as string;

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [claimConfirmationSent, setClaimConfirmationSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<DealResponse>({
    queryKey: ['public-deal', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/public/deals/${dealId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Deal not found');
      }
      return res.json();
    },
    enabled: !!dealId,
  });

  const deal = data?.deal;
  const isPurchaseFlow = deal?.deliveryType === 'purchase_link';

  useEffect(() => {
    if (deal?.selectableServices.length === 1) {
      setSelectedServiceIds([deal.selectableServices[0].id]);
    }
  }, [deal]);

  const selectedServices = useMemo(
    () => (deal?.selectableServices ?? []).filter((service) => selectedServiceIds.includes(service.id)),
    [deal?.selectableServices, selectedServiceIds]
  );
  const totals = useMemo(
    () =>
      calculatePreviewTotals(
        deal?.discountType ?? 'percent_off',
        deal?.discountValue ?? 0,
        selectedServices
      ),
    [deal?.discountType, deal?.discountValue, selectedServices]
  );

  const phoneReady = useMemo(() => customerPhone.replace(/\D/g, '').length >= 10, [customerPhone]);

  function toggleService(serviceId: string) {
    if (!deal) return;
    if (deal.discountType === 'free_service') {
      setSelectedServiceIds((current) => (current[0] === serviceId ? [] : [serviceId]));
      return;
    }
    setSelectedServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
  }

  function handleContinueToCheckout() {
    const query = selectedServiceIds.join(',');
    router.push(`/d/${dealId}/checkout?services=${encodeURIComponent(query)}`);
  }

  async function claimDeal() {
    setIsSubmitting(true);
    setSubmitError(null);
    setClaimCode(null);
    setClaimConfirmationSent(false);

    try {
      const res = await fetch(`/api/public/deals/${dealId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, customerPhone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not claim this deal');
      }
      const body = await res.json();
      setClaimCode(body.code);
      setClaimConfirmationSent(body.confirmationSent === true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not claim this deal');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="brand-shell min-h-screen">
        <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="brand-panel w-full max-w-md rounded-[28px] p-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">Loading deal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div className="brand-shell min-h-screen">
        <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="brand-panel w-full max-w-md rounded-[28px] p-8 text-center">
            <h1 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Deal unavailable
            </h1>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              This promotion is no longer active.
            </p>
            <Link href="/explore" className="text-sm font-medium text-primary hover:underline">
              Browse active deals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-shell min-h-screen">
      <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
      <div className="px-4 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl space-y-6">
          {deal.viewerCanManage && (
            <Link
              href="/dashboard/campaigns"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <span aria-hidden="true">&larr;</span>
              Back to deals
            </Link>
          )}

          <section className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
            <div className="relative overflow-hidden rounded-[32px] brand-hero p-6 sm:p-8">
              <div className="relative space-y-5">
                <div className="brand-hero-kicker flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
                  <span>{deal.business.name}</span>
                  <span className="brand-hero-chip rounded-full px-3 py-1 text-[11px]">
                    {discountLabel(deal.discountType, deal.discountValue)}
                  </span>
                  {deal.business.city && (
                    <span className="brand-hero-chip rounded-full px-3 py-1 text-[11px]">
                      {deal.business.city}
                      {deal.business.state ? `, ${deal.business.state}` : ''}
                    </span>
                  )}
                </div>

                <div>
                  <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
                    {deal.title}
                  </h1>
                  {deal.description && (
                    <p className="brand-hero-muted mt-3 max-w-2xl text-sm leading-6 sm:text-base">
                      {deal.description}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="brand-hero-card rounded-2xl px-4 py-4">
                    <p className="brand-hero-soft text-xs font-semibold uppercase tracking-[0.18em]">
                      Expires
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-950 dark:text-white">
                      {new Date(deal.expiresAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="brand-hero-card rounded-2xl px-4 py-4">
                    <p className="brand-hero-soft text-xs font-semibold uppercase tracking-[0.18em]">
                      Discount
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-950 dark:text-white">
                      {discountLabel(deal.discountType, deal.discountValue)}
                    </p>
                  </div>
                  <div className="brand-hero-card rounded-2xl px-4 py-4">
                    <p className="brand-hero-soft text-xs font-semibold uppercase tracking-[0.18em]">
                      Delivery
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-950 dark:text-white">
                      {isPurchaseFlow ? 'Online checkout' : 'Claim code'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                  <Link
                    href={`/business/${deal.business.publicId}`}
                    className="brand-hero-link transition"
                  >
                    View business profile
                  </Link>
                  <Link
                    href={
                      deal.business.city
                        ? `/explore?location=${encodeURIComponent(deal.business.city)}`
                        : '/explore'
                    }
                    className="brand-hero-link transition"
                  >
                    Find more deals nearby
                  </Link>
                </div>
              </div>
            </div>

            <aside className="brand-panel rounded-[32px] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Before checkout
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Choose the services you want and review the total before paying.
              </h2>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-gray-200 bg-white/75 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Selected today
                  </p>
                  <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedServices.length === 0
                      ? 'No services selected yet'
                      : `${selectedServices.length} service${selectedServices.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 dark:border-primary/20 dark:bg-primary/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Estimated total
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {formatMoney(totals.total)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Discount applied automatically at checkout.
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/75 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/70">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Why this feels safer
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                    <p>Clear pricing before payment.</p>
                    <p>Secure checkout powered by Stripe.</p>
                    <p>Receipt and redemption details sent right after purchase.</p>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <div className="space-y-6 rounded-[32px] brand-panel p-6 shadow-[0_30px_80px_-50px_rgba(6,17,24,0.55)]">
            {isPurchaseFlow ? (
              <div className="grid gap-6 xl:grid-cols-[1.12fr,0.88fr]">
                <div className="space-y-4">
                  {deal.selectableServices.length === 1 ? (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Service included
                      </h2>
                      <div className="mt-4 rounded-[24px] border border-primary/15 bg-primary/5 p-5 shadow-sm dark:border-primary/20 dark:bg-primary/10">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {deal.selectableServices[0].name}
                            </p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {deal.selectableServices[0].duration} min
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">
                              {formatMoney(deal.selectableServices[0].price)}
                            </p>
                            <p className="mt-1 text-xs text-primary">Included</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Choose your services
                      </h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {deal.serviceScope === 'all_services'
                          ? 'This deal applies to any of the services below.'
                          : 'This deal only applies to these eligible services.'}
                      </p>
                      <div className="mt-4 space-y-3">
                        {deal.selectableServices.map((service) => {
                          const selected = selectedServiceIds.includes(service.id);
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => toggleService(service.id)}
                              className={`w-full rounded-[24px] border px-5 py-4 text-left transition-all duration-200 ${
                                selected
                                  ? 'border-primary/25 bg-primary/8 shadow-[0_24px_60px_-36px_rgba(15,138,99,0.55)]'
                                  : 'border-gray-200 bg-white/80 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_20px_50px_-36px_rgba(6,17,24,0.4)] dark:border-gray-700 dark:bg-gray-900/75'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                                    {service.name}
                                  </p>
                                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {service.duration} min
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                                    {formatMoney(service.price)}
                                  </p>
                                  <p className="mt-1 text-xs text-primary">
                                    {selected
                                      ? 'Selected'
                                      : deal.discountType === 'free_service'
                                        ? 'Choose one'
                                        : 'Tap to add'}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <aside className="rounded-[28px] border border-gray-200 bg-white/80 p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/70">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Order summary
                    </h2>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                      Premium offer
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedServices.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {deal.selectableServices.length === 1
                          ? 'Loading...'
                          : 'Select at least one service to continue.'}
                      </p>
                    ) : (
                      selectedServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-start justify-between gap-4 text-sm"
                        >
                          <span className="text-gray-700 dark:text-gray-200">{service.name}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatMoney(service.price)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-5 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                      <span>Subtotal</span>
                      <span>{formatMoney(totals.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-primary">
                      <span>Deal discount</span>
                      <span>-{formatMoney(totals.discount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
                      <span>Total due</span>
                      <span>{formatMoney(totals.total)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleContinueToCheckout}
                    disabled={selectedServiceIds.length === 0}
                    className="mt-5 w-full rounded-2xl bg-primary py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue to Checkout
                  </button>

                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Apple Pay, Google Pay, and cards accepted.
                  </p>
                </aside>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="deal-claim-name"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Your Name
                  </label>
                  <input
                    id="deal-claim-name"
                    type="text"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="deal-claim-phone"
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Mobile Phone
                  </label>
                  <input
                    id="deal-claim-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  By claiming, you consent to receive your redemption code by text. Reply STOP to
                  opt out, HELP for help.
                </p>
                <button
                  type="button"
                  onClick={claimDeal}
                  disabled={!customerName.trim() || !phoneReady || isSubmitting}
                  className="w-full rounded-2xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Claiming...' : 'Claim Deal Code'}
                </button>
                {submitError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                )}
              </div>
            )}

            {claimCode && (
              <div className="rounded-[24px] border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-900/20">
                <p className="mb-1 text-sm text-green-800 dark:text-green-300">
                  Your code is ready:
                </p>
                <p className="font-mono text-lg font-bold text-green-900 dark:text-green-200">
                  {claimCode}
                </p>
                <p className="mt-2 text-xs text-green-800 dark:text-green-300">
                  Show this code at checkout for redemption.
                </p>
                {claimConfirmationSent && (
                  <p className="mt-2 text-xs text-green-800 dark:text-green-300">
                    We also texted this code to your phone.
                  </p>
                )}
                <Link
                  href={`/book/${deal.business.publicId}`}
                  className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Optional: Book now
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
