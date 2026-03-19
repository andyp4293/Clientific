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

  // Code-claim flow state
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

  // Auto-select the only service when there's exactly one option
  useEffect(() => {
    if (deal?.selectableServices.length === 1) {
      setSelectedServiceIds([deal.selectableServices[0].id]);
    }
  }, [deal]);

  const selectedServices = useMemo(
    () => (deal?.selectableServices ?? []).filter((s) => selectedServiceIds.includes(s.id)),
    [deal?.selectableServices, selectedServiceIds]
  );
  const totals = useMemo(
    () => calculatePreviewTotals(deal?.discountType ?? 'percent_off', deal?.discountValue ?? 0, selectedServices),
    [deal?.discountType, deal?.discountValue, selectedServices]
  );

  const phoneReady = useMemo(() => customerPhone.replace(/\D/g, '').length >= 10, [customerPhone]);

  function toggleService(serviceId: string) {
    if (!deal) return;
    if (deal.discountType === 'free_service') {
      setSelectedServiceIds((cur) => (cur[0] === serviceId ? [] : [serviceId]));
      return;
    }
    setSelectedServiceIds((cur) =>
      cur.includes(serviceId) ? cur.filter((id) => id !== serviceId) : [...cur, serviceId]
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
      <div className="page-shell min-h-screen">
        <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
        <div className="flex items-center justify-center px-4 py-20">
          <p className="text-sm text-gray-600 dark:text-gray-300">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div className="page-shell min-h-screen">
        <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800">
            <h1 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Deal unavailable</h1>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">This promotion is no longer active.</p>
            <Link href="/explore" className="text-sm font-medium text-primary hover:underline">Browse active deals</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-screen">
      <PublicSiteHeader active="deal" showLogin={false} showCta={false} />
      <div className="px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {deal.viewerCanManage && (
            <Link href="/dashboard/campaigns" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <span aria-hidden="true">&larr;</span> Back to deals
            </Link>
          )}

          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {/* Deal header */}
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{deal.business.name}</p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{deal.title}</h1>
                <span className="rounded bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {discountLabel(deal.discountType, deal.discountValue)}
                </span>
              </div>
              {deal.description && <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{deal.description}</p>}
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Expires{' '}
                {new Date(deal.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium">
              <Link href={`/business/${deal.business.publicId}`} className="text-primary hover:underline">View business profile</Link>
              <Link href={deal.business.city ? `/explore?location=${encodeURIComponent(deal.business.city)}` : '/explore'} className="text-primary hover:underline">Find more deals nearby</Link>
            </div>

            {/* Purchase link flow: service selection + order summary */}
            {isPurchaseFlow ? (
              <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="space-y-4">
                  {deal.selectableServices.length === 1 ? (
                    // Single service: show as read-only, no picker needed
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Service included</h2>
                      <div className="mt-3 rounded-2xl border border-primary bg-primary/5 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{deal.selectableServices[0].name}</p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{deal.selectableServices[0].duration} min</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{formatMoney(deal.selectableServices[0].price)}</p>
                            <p className="mt-1 text-xs text-primary">Included</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Multiple services: show picker
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Choose your services</h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {deal.serviceScope === 'all_services'
                          ? 'This deal applies to any of the services below.'
                          : 'This deal only applies to these eligible services.'}
                      </p>
                      <div className="mt-3 space-y-3">
                        {deal.selectableServices.map((service) => {
                          const selected = selectedServiceIds.includes(service.id);
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => toggleService(service.id)}
                              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                                selected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-200 bg-white hover:border-primary/40 dark:border-gray-700 dark:bg-gray-900'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-gray-100">{service.name}</p>
                                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{service.duration} min</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900 dark:text-gray-100">{formatMoney(service.price)}</p>
                                  <p className="mt-1 text-xs text-primary">
                                    {selected ? 'Selected' : deal.discountType === 'free_service' ? 'Choose one' : 'Tap to add'}
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

                <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/70">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order summary</h2>
                  <div className="mt-4 space-y-3">
                    {selectedServices.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {deal.selectableServices.length === 1 ? 'Loading...' : 'Select at least one service to continue.'}
                      </p>
                    ) : (
                      selectedServices.map((service) => (
                        <div key={service.id} className="flex items-start justify-between gap-4 text-sm">
                          <span className="text-gray-700 dark:text-gray-200">{service.name}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{formatMoney(service.price)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-5 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                      <span>Subtotal</span><span>{formatMoney(totals.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-primary">
                      <span>Deal discount</span><span>-{formatMoney(totals.discount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
                      <span>Total due</span><span>{formatMoney(totals.total)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleContinueToCheckout}
                    disabled={selectedServiceIds.length === 0}
                    className="mt-5 w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue to Checkout
                  </button>

                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Apple Pay, Google Pay, and cards accepted.
                  </p>
                </aside>
              </div>
            ) : (
              // ── Code-claim flow (inline, unchanged) ─────────────────────
              <div className="space-y-3">
                <div>
                  <label htmlFor="deal-claim-name" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Your Name</label>
                  <input
                    id="deal-claim-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label htmlFor="deal-claim-phone" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Phone</label>
                  <input
                    id="deal-claim-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  By claiming, you consent to receive your redemption code by text. Reply STOP to opt out, HELP for help.
                </p>
                <button
                  type="button"
                  onClick={claimDeal}
                  disabled={!customerName.trim() || !phoneReady || isSubmitting}
                  className="w-full rounded-xl bg-primary py-3 font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Claiming...' : 'Claim Deal Code'}
                </button>
                {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}
              </div>
            )}

            {claimCode && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="mb-1 text-sm text-green-800 dark:text-green-300">Your code is ready:</p>
                <p className="font-mono text-lg font-bold text-green-900 dark:text-green-200">{claimCode}</p>
                <p className="mt-2 text-xs text-green-800 dark:text-green-300">Show this code at checkout for redemption.</p>
                {claimConfirmationSent && (
                  <p className="mt-2 text-xs text-green-800 dark:text-green-300">We also texted this code to your phone.</p>
                )}
                <Link href={`/book/${deal.business.publicId}`} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
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
