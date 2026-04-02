'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DashboardPageLoading } from '@/components/layout/DashboardPageLoading';
import { DatePicker } from '@/components/ui/DatePicker';
import { CustomSelect } from '@/components/ui/CustomSelect';
import InStoreCapturePanel from '@/components/campaigns/InStoreCapturePanel';
import { addDays, fromDateOnlyValue, isDealEndSameOrBeforeStart, isDealStartBeforeToday, toDateOnlyValue } from '@/lib/deal-dates';

type Purchase = {
  id: string; token: string; status: string; customerName: string; customerPhone: string; customerEmail: string | null;
  totalAmount: number; redemptionCode: string | null; stripeReceiptUrl: string | null; purchasedAt: string | null; redeemedAt: string | null;
  items: { id: string; serviceName: string; discountedUnitAmount: number }[];
};
type Deal = {
  id: string; title: string; description: string | null; deliveryType: string; serviceScope: string; discountType: string; discountValue: number;
  newCustomersOnly: boolean;
  service: { name: string } | null; eligibleServices: { id: string; name: string }[]; startsAt: string; expiresAt: string; maxRedemptions: number | null;
  redemptionCount: number; active: boolean; notifiedAt: string | null; revenueTracked: number; platformFeesOwed: number;
  purchases: Purchase[]; redemptions: { id: string; code: string; usedAt: string | null }[]; notificationSends: { id: string; createdAt: string; customerName: string | null; customerPhone: string; code: string | null; purchaseUrl: string | null; status: string; errorMessage: string | null }[];
};
type ConnectStatus = {
  readyForPaidDeals: boolean;
  notConnected: boolean;
};

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const cents = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
const phone = (value: string) => { const d = value.replace(/\D/g, ''); return d.length === 11 && d.startsWith('1') ? `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : value; };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Pending';
const discount = (deal: Pick<Deal, 'discountType' | 'discountValue'>) => deal.discountType === 'percent_off' ? `${deal.discountValue}% off` : deal.discountType === 'amount_off' ? `$${deal.discountValue} off` : 'Free service';
const serviceScopeLabel = (deal: Deal) => deal.deliveryType === 'code_claim' ? deal.service?.name ?? 'Any service' : deal.serviceScope === 'all_services' ? 'Any active service' : (deal.eligibleServices ?? []).map((s) => s.name).join(', ') || 'Selected services';

function createDefaultForm() {
  const today = new Date();
  return { title: '', description: '', discountType: 'percent_off', discountValue: '', serviceScope: 'all_services', eligibleServiceIds: [] as string[], newCustomersOnly: false, startsAt: toDateOnlyValue(today), expiresAt: toDateOnlyValue(addDays(today, 1)), maxRedemptions: '' };
}

function createDefaultExtensionDate() {
  return toDateOnlyValue(addDays(new Date(), 7));
}

export default function DealsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(createDefaultForm);
  const [extendDeal, setExtendDeal] = useState<{ id: string; title: string; startsAt: string; expiresAt: string } | null>(null);
  const [extendExpiresAt, setExtendExpiresAt] = useState(createDefaultExtensionDate);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmingNotify, setConfirmingNotify] = useState<string | null>(null);
  const [sendingNotifyId, setSendingNotifyId] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState('');
  const [redeemingPurchaseId, setRedeemingPurchaseId] = useState<string | null>(null);
  const [showQrDeal, setShowQrDeal] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  const { data: dealsData, isLoading } = useQuery({ queryKey: ['deals'], queryFn: async () => { const res = await fetch('/api/deals'); if (!res.ok) throw new Error('Failed'); return res.json(); } });
  const { data: servicesData } = useQuery({ queryKey: ['services'], queryFn: async () => { const res = await fetch('/api/services'); if (!res.ok) throw new Error('Failed'); return res.json(); } });
  const { data: businessData } = useQuery({ queryKey: ['business'], queryFn: async () => { const res = await fetch('/api/business'); if (!res.ok) throw new Error('Failed'); return res.json(); } });
  const { data: payoutStatusData } = useQuery<ConnectStatus>({ queryKey: ['connect-account'], queryFn: async () => { const res = await fetch('/api/stripe/connect/account'); if (!res.ok) throw new Error('Failed'); return res.json(); } });

  const deals: Deal[] = (dealsData?.deals ?? []).map((deal: any) => ({
    ...deal,
    eligibleServices: deal.eligibleServices ?? [],
    purchases: deal.purchases ?? [],
    redemptions: deal.redemptions ?? [],
    notificationSends: deal.notificationSends ?? [],
  }));
  const services: { id: string; name: string }[] = servicesData?.services ?? [];
  const business = businessData?.business ? { name: businessData.business.name, publicId: businessData.business.publicId } : null;
  const payoutReady = Boolean(payoutStatusData?.readyForPaidDeals);
  const purchases = useMemo(() => deals.flatMap((deal) => deal.purchases.map((purchase) => ({ ...purchase, dealTitle: deal.title }))), [deals]);
  const lookupMatches = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase(); if (!q) return [];
    return purchases.filter((purchase) => [purchase.customerName, purchase.customerPhone, purchase.customerEmail ?? '', purchase.redemptionCode ?? '', purchase.dealTitle].join(' ').toLowerCase().includes(q));
  }, [purchases, lookupQuery]);

  if (isLoading) {
    return <DashboardPageLoading />;
  }

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: payload.title, description: payload.description, deliveryType: 'purchase_link', serviceScope: payload.serviceScope, eligibleServiceIds: payload.serviceScope === 'selected_services' ? payload.eligibleServiceIds : [], discountType: payload.discountType, discountValue: payload.discountType === 'free_service' ? 0 : Number(payload.discountValue), newCustomersOnly: payload.newCustomersOnly, startsAt: payload.startsAt, expiresAt: payload.expiresAt, maxRedemptions: payload.maxRedemptions ? Number(payload.maxRedemptions) : null }) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.error || 'Failed to create deal'); return body;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deals'] }); setForm(createDefaultForm()); setShowForm(false); toast.success('Deal created'); },
    onError: (error: any) => toast.error(error?.message || 'Failed to create deal'),
  });
  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const res = await fetch(`/api/deals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  });
  const extendMutation = useMutation({
    mutationFn: async ({ id, expiresAt }: { id: string; expiresAt: string }) => {
      const res = await fetch(`/api/deals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresAt }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to extend deal');
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setExtendDeal(null);
      setExtendExpiresAt(createDefaultExtensionDate());
      toast.success('Deal extended');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to extend deal'),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error('Failed'); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deals'] }); setConfirmDelete(null); toast.success('Deal deleted'); },
  });
  const notifyMutation = useMutation({
    mutationFn: async (dealId: string) => { const res = await fetch(`/api/deals/${dealId}/notify`, { method: 'POST' }); const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.error || 'Failed to send deal texts'); return body as { sent: number; alreadySent?: number }; },
    onSuccess: (body) => { queryClient.invalidateQueries({ queryKey: ['deals'] }); toast.success(body.sent === 0 ? `No new texts sent. ${body.alreadySent ?? 0} customers already had this deal.` : `Sent ${body.sent} new deal text${body.sent === 1 ? '' : 's'}.`); },
    onError: (error: any) => toast.error(error?.message || 'Failed to send deal texts'),
    onSettled: () => setSendingNotifyId(null),
  });
  const redeemMutation = useMutation({
    mutationFn: async ({ purchaseId }: { purchaseId: string }) => { const res = await fetch('/api/deal-purchases/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseId }) }); const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.error || 'Failed to redeem purchase'); return body as { alreadyRedeemed: boolean; purchase: { customerName: string } }; },
    onSuccess: (body) => { queryClient.invalidateQueries({ queryKey: ['deals'] }); toast.success(body.alreadyRedeemed ? `${body.purchase.customerName}'s purchase was already redeemed.` : `Redeemed ${body.purchase.customerName}'s purchase.`); },
    onError: (error: any) => toast.error(error?.message || 'Failed to redeem purchase'),
    onSettled: () => setRedeemingPurchaseId(null),
  });

  useEffect(() => {
    if (!showForm) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowForm(false); };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [showForm]);

  const minimumEndDate = addDays(fromDateOnlyValue(form.startsAt) ?? new Date(), 1);
  const eligibleSelectionRequired = form.serviceScope === 'selected_services';

  function copyDealLink(dealId: string) {
    const url = `${window.location.origin}/d/${dealId}`;
    navigator.clipboard.writeText(url);
    toast.success('Deal link copied!');
  }

  function downloadQr(dealId: string) {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `deal-${dealId}-qr.png`;
    a.click();
  }

  function toggleEligibleService(serviceId: string) {
    setForm((current) => {
      const selected = current.eligibleServiceIds.includes(serviceId);
      const next = current.discountType === 'free_service' ? (selected ? [] : [serviceId]) : selected ? current.eligibleServiceIds.filter((id) => id !== serviceId) : [...current.eligibleServiceIds, serviceId];
      return { ...current, eligibleServiceIds: next };
    });
  }

  function openExtendDeal(deal: Pick<Deal, 'id' | 'title' | 'startsAt' | 'expiresAt'>) {
    setExtendDeal({ id: deal.id, title: deal.title, startsAt: deal.startsAt, expiresAt: deal.expiresAt });
    setExtendExpiresAt(createDefaultExtensionDate());
  }

  function closeExtendDeal() {
    setExtendDeal(null);
    setExtendExpiresAt(createDefaultExtensionDate());
  }

  function submitExtension(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!extendDeal) return;
    if (!extendExpiresAt) return toast.error('Choose a new end date');
    if (isDealStartBeforeToday(extendExpiresAt)) return toast.error('New end date cannot be earlier than today');
    if (isDealEndSameOrBeforeStart(extendDeal.startsAt, extendExpiresAt)) return toast.error('New end date must be after the deal start date');
    extendMutation.mutate({ id: extendDeal.id, expiresAt: extendExpiresAt });
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title || !form.startsAt || !form.expiresAt) return toast.error('Fill in the required fields');
    if (isDealStartBeforeToday(form.startsAt)) return toast.error('Start date cannot be earlier than today');
    if (isDealEndSameOrBeforeStart(form.startsAt, form.expiresAt)) return toast.error('End date must be at least one day after start date');
    if (eligibleSelectionRequired && form.eligibleServiceIds.length === 0) return toast.error('Choose at least one eligible service');
    if (form.discountType === 'free_service' && form.eligibleServiceIds.length !== 1) return toast.error('Free service deals must target exactly one service');
    createMutation.mutate(form);
  }

  return (
    <div data-testid="deals-page" className="w-full space-y-4 pb-28 sm:space-y-6 md:pb-8">
      {payoutStatusData && !payoutReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-900/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Set up payouts before publishing paid deals</p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                Paid purchase-link deals need payout setup first. Free-service deals can still be created without it.
              </p>
            </div>
            <a href="/dashboard/payouts" className="btn-primary text-sm">
              Open Payouts
            </a>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Deals</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create purchased promotions, track receipts, and redeem them in-store.</p></div><button onClick={() => setShowForm((current) => !current)} className="btn-primary shrink-0 text-sm">{showForm ? 'Close' : 'New Deal'}</button></div>
<section className="card p-5 md:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Purchase lookup</p><h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Search by code, phone, or customer</h2></div><input value={lookupQuery} onChange={(event) => setLookupQuery(event.target.value)} placeholder="Search receipt history" className="input min-w-[260px] text-sm" /></div>{lookupQuery.trim() && <div className="mt-4 space-y-2">{lookupMatches.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No purchases matched that search yet.</p> : lookupMatches.slice(0, 8).map((purchase) => <div key={purchase.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4 dark:border-gray-800"><div><p className="font-semibold text-gray-900 dark:text-gray-100">{purchase.customerName}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{purchase.dealTitle} • {phone(purchase.customerPhone)} • {purchase.redemptionCode ?? 'No code yet'}</p></div><div className="flex items-center gap-2"><a href={`/deal-purchases/${purchase.token}`} target="_blank" rel="noreferrer" className="btn-outline text-xs">Open receipt</a><button type="button" onClick={() => { setRedeemingPurchaseId(purchase.id); redeemMutation.mutate({ purchaseId: purchase.id }); }} disabled={redeemingPurchaseId !== null || Boolean(purchase.redeemedAt)} className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60">{purchase.redeemedAt ? 'Already redeemed' : redeemingPurchaseId === purchase.id ? 'Redeeming...' : 'Redeem'}</button></div></div>)}</div>}</section>
      <InStoreCapturePanel business={business} deals={deals} />
      {showForm && (
        <div
          data-mobile-overlay="true"
          className="fixed inset-0 z-[70] bg-black/55 p-0 sm:flex sm:items-center sm:justify-center sm:p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-deal-modal-title"
            className="flex h-[100dvh] min-h-[100dvh] w-full flex-col border-0 bg-white shadow-2xl dark:bg-gray-900 sm:h-auto sm:min-h-0 sm:max-h-[92vh] sm:max-w-3xl sm:overflow-hidden sm:rounded-3xl sm:border sm:border-gray-200 sm:shadow-2xl dark:sm:border-gray-700"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-gray-800 sm:px-6 sm:pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">New deal</p>
                <h2 id="new-deal-modal-title" className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                  Create a new promotion
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close new deal modal"
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={submitForm} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Title <span className="text-red-500">*</span></label><input className="input text-sm" placeholder="e.g. 20% off gel manicure this week" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></div>
                    <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Discount Type <span className="text-red-500">*</span></label><CustomSelect className="input text-sm" value={form.discountType} onChange={(val) => setForm((current) => ({ ...current, discountType: val, serviceScope: val === 'free_service' ? 'selected_services' : current.serviceScope, eligibleServiceIds: val === 'free_service' ? (services.length === 1 ? [services[0].id] : current.eligibleServiceIds.length > 1 ? current.eligibleServiceIds.slice(0, 1) : current.eligibleServiceIds) : current.eligibleServiceIds }))} options={[{ value: 'percent_off', label: '% off' }, { value: 'amount_off', label: '$ off' }, { value: 'free_service', label: 'Free service' }]} /></div>
                    {form.discountType !== 'free_service' && <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{form.discountType === 'percent_off' ? 'Percent off' : 'Amount off ($)'} <span className="text-red-500">*</span></label><input className="input text-sm" type="number" min="0" step={form.discountType === 'percent_off' ? '1' : '0.01'} max={form.discountType === 'percent_off' ? '100' : undefined} placeholder={form.discountType === 'percent_off' ? '20' : '10.00'} value={form.discountValue} onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))} required /></div>}
                    <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Where the deal applies</label><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setForm((current) => ({ ...current, serviceScope: 'all_services', eligibleServiceIds: [] }))} disabled={form.discountType === 'free_service'} className={`rounded-2xl border p-4 text-left text-sm ${form.serviceScope === 'all_services' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'} ${form.discountType === 'free_service' ? 'cursor-not-allowed opacity-60' : ''}`}><p className="font-semibold text-gray-900 dark:text-gray-100">Any active service</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Customers can choose multiple services.</p></button><button type="button" onClick={() => setForm((current) => ({ ...current, serviceScope: 'selected_services', eligibleServiceIds: services.length === 1 ? [services[0].id] : current.eligibleServiceIds }))} className={`rounded-2xl border p-4 text-left text-sm ${form.serviceScope === 'selected_services' ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}><p className="font-semibold text-gray-900 dark:text-gray-100">Selected services only</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Limit this deal to specific services.</p></button></div></div>
                    {eligibleSelectionRequired && (services.length === 1 ? <div className="sm:col-span-2"><p className="text-sm text-gray-500 dark:text-gray-400">Applies to: <span className="font-medium text-gray-900 dark:text-gray-100">{services[0].name}</span></p></div> : <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Eligible services</label><div className="grid gap-2 sm:grid-cols-2">{services.map((service) => <button key={service.id} type="button" onClick={() => toggleEligibleService(service.id)} className={`rounded-2xl border px-4 py-3 text-left text-sm ${form.eligibleServiceIds.includes(service.id) ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}><span className="font-medium text-gray-900 dark:text-gray-100">{service.name}</span></button>)}</div></div>)}
                    <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Max purchases (optional)</label><input className="input text-sm" type="number" min="1" placeholder="Unlimited" value={form.maxRedemptions} onChange={(event) => setForm((current) => ({ ...current, maxRedemptions: event.target.value }))} /></div>
                    <div className="sm:col-span-2">
                      <div className="rounded-[24px] border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                        <div className="flex items-start justify-between gap-4">
                          <div className="pr-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">New customers only</p>
                            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                              Only people whose phone number is not already in your customer database can claim or buy this promotion.
                            </p>
                            {form.newCustomersOnly ? (
                              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                                Text My Customers will be disabled for this deal because your saved customers would not qualify.
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={form.newCustomersOnly}
                            aria-label="Toggle new customers only"
                            onClick={() => setForm((current) => ({ ...current, newCustomersOnly: !current.newCustomersOnly }))}
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${form.newCustomersOnly ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                          >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.newCustomersOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Start date <span className="text-red-500">*</span></label><DatePicker value={fromDateOnlyValue(form.startsAt)} onChange={(date) => setForm((current) => { const startsAt = toDateOnlyValue(date); const currentEndDate = fromDateOnlyValue(current.expiresAt); const nextMinimumEndDate = addDays(date, 1); return { ...current, startsAt, expiresAt: !currentEndDate || isDealEndSameOrBeforeStart(date, currentEndDate) ? toDateOnlyValue(nextMinimumEndDate) : current.expiresAt }; })} minDate={new Date(new Date().setHours(0, 0, 0, 0))} placeholder="Select start date" /></div>
                    <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">End date <span className="text-red-500">*</span></label><DatePicker value={fromDateOnlyValue(form.expiresAt)} onChange={(date) => setForm((current) => ({ ...current, expiresAt: toDateOnlyValue(date) }))} minDate={minimumEndDate} placeholder="Select end date" /></div>
                    <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Description (optional)</label><input className="input text-sm" placeholder="Any additional details for the customer" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
                    By creating this deal, you agree to Clientific&apos;s{' '}
                    <a href="/terms" target="_blank" className="underline hover:text-gray-600 dark:hover:text-gray-300">Terms of Service</a>.
                    {' '}Clientific charges a 10% service fee on each paid deal purchase, deducted before your Stripe-powered payout. Free and code-claim deals are not subject to this fee.
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-gray-800 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm" disabled={createMutation.isPending}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary text-sm">{createMutation.isPending ? 'Creating...' : 'Create Deal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deals.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-sm text-gray-500 dark:text-gray-400">No deals yet. Create your first purchased deal with the New Deal button.</p></div>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => {
            const isExpired = new Date(deal.expiresAt) <= new Date();
            const isFull = deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions;
            const isExpanded = expandedDeal === deal.id;
            const isExtendingThisDeal = extendDeal?.id === deal.id;
            const isSendingThisDeal = sendingNotifyId === deal.id;
            const notifyButtonsDisabled = sendingNotifyId !== null;

            return (
              <div key={deal.id} className="card overflow-hidden">
                <div className="p-4 md:p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{discount(deal)}</span><span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{deal.deliveryType === 'purchase_link' ? 'Purchase link' : 'Legacy code'}</span>{isExpired && <span className="text-xs font-medium text-red-500">Expired</span>}{isFull && !isExpired && <span className="text-xs font-medium text-gray-400">Max reached</span>}</div>
                    <div className="flex shrink-0 items-center gap-3"><button onClick={() => toggleMutation.mutate({ id: deal.id, active: !deal.active })} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${deal.active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}><span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${deal.active ? 'translate-x-4' : 'translate-x-1'}`} /></button>{confirmDelete === deal.id ? <div className="flex items-center gap-1.5"><button onClick={() => deleteMutation.mutate(deal.id)} disabled={deleteMutation.isPending} className="text-xs font-semibold text-red-600 hover:underline">Delete</button><button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 hover:underline">Cancel</button></div> : <button onClick={() => setConfirmDelete(deal.id)} className="text-gray-400 transition-colors hover:text-red-500" title="Delete"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}</div>
                  </div>
                  <p className="mb-1.5 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">{deal.title}</p>
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"><span>{serviceScopeLabel(deal)}</span><span className="text-gray-300 dark:text-gray-600">-</span><span>{shortDate(deal.startsAt)} - {shortDate(deal.expiresAt)}</span><span className="text-gray-300 dark:text-gray-600">-</span><span>{deal.redemptionCount}{deal.maxRedemptions ? ` / ${deal.maxRedemptions}` : ''} sold</span></div>
                  {deal.newCustomersOnly && (
                    <div className="mb-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                      New customers only
                    </div>
                  )}
                  {(deal.revenueTracked > 0 || deal.purchases.length > 0) && <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400"><span>Revenue tracked: <span className="font-semibold text-gray-700 dark:text-gray-300">{money(deal.revenueTracked)}</span></span><span className="text-gray-300 dark:text-gray-600">-</span><span>Platform fees: <span className="font-semibold text-gray-700 dark:text-gray-300">{money(deal.platformFeesOwed)}</span></span></div>}
                  {deal.deliveryType === 'purchase_link' && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
                        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        <span className="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400">{typeof window !== 'undefined' ? `${window.location.origin}/d/${deal.id}` : `/d/${deal.id}`}</span>
                        <button type="button" onClick={() => copyDealLink(deal.id)} className="shrink-0 text-xs font-semibold text-primary hover:underline">Copy</button>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <button type="button" onClick={() => setShowQrDeal(showQrDeal === deal.id ? null : deal.id)} className="shrink-0 text-xs font-semibold text-primary hover:underline">{showQrDeal === deal.id ? 'Hide QR' : 'QR code'}</button>
                      </div>
                      {showQrDeal === deal.id && (
                        <div className="mt-3 flex flex-col items-center gap-2">
                          <div ref={qrCanvasRef} className="rounded-xl bg-white p-3 shadow-sm dark:bg-white">
                            <QRCodeCanvas value={`${window.location.origin}/d/${deal.id}`} size={180} level="M" />
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Customers scan to access this deal</p>
                          <button type="button" onClick={() => downloadQr(deal.id)} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download QR
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {isExpired && isExtendingThisDeal && (
                    <form onSubmit={submitExtension} className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Extend this expired promo</p>
                          <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">
                            Pick a new end date to make this promotion live again. If the deal is still active, it becomes available right away.
                          </p>
                        </div>
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          Expired {shortDate(deal.expiresAt)}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="w-full sm:max-w-xs">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">New end date</label>
                          <DatePicker value={fromDateOnlyValue(extendExpiresAt)} onChange={(date) => setExtendExpiresAt(toDateOnlyValue(date))} minDate={new Date(new Date().setHours(0, 0, 0, 0))} placeholder="Select new end date" />
                        </div>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                          <button type="button" onClick={closeExtendDeal} className="btn-outline text-sm" disabled={extendMutation.isPending}>Cancel</button>
                          <button type="submit" className="btn-primary text-sm" disabled={extendMutation.isPending}>
                            {extendMutation.isPending ? 'Saving...' : 'Save extension'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setExpandedDeal(isExpanded ? null : deal.id)} className="text-xs font-semibold text-primary transition-colors hover:text-primary/80">{isExpanded ? 'Hide activity' : 'View activity'}</button>
                      {isExpired && (
                        <button type="button" onClick={() => openExtendDeal(deal)} className="text-xs font-semibold text-primary transition-colors hover:text-primary/80">
                          {isExtendingThisDeal ? 'Editing extension' : 'Extend promo'}
                        </button>
                      )}
                    </div>
                    {deal.active && !isExpired && !deal.newCustomersOnly && (confirmingNotify === deal.id ? <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-gray-600 dark:text-gray-400">Send each opted-in customer this purchase link by text?</span><button onClick={() => { if (sendingNotifyId !== null) return; setSendingNotifyId(deal.id); setConfirmingNotify(null); notifyMutation.mutate(deal.id); }} disabled={sendingNotifyId !== null} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">Yes, send</button><button onClick={() => setConfirmingNotify(null)} disabled={sendingNotifyId !== null} className="text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button></div> : <button onClick={() => setConfirmingNotify(deal.id)} disabled={notifyButtonsDisabled} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">{isSendingThisDeal ? 'Sending...' : 'Text My Customers'}</button>)}
                    {deal.active && !isExpired && deal.newCustomersOnly && (
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Text My Customers is disabled because this promotion only works for new customers who are not already in your database.
                      </p>
                    )}
                  </div>
                </div>
                {isExpanded && <div className="border-t border-gray-100 px-4 py-4 dark:border-gray-700 md:px-5"><div className="grid gap-5 xl:grid-cols-2"><section className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">Purchases</h3><span className="text-xs text-gray-400 dark:text-gray-500">{deal.purchases.length}</span></div>{deal.purchases.length === 0 ? <p className="text-xs text-gray-400 dark:text-gray-500">No purchases yet.</p> : <div className="max-h-96 space-y-2 overflow-y-auto pr-1">{deal.purchases.map((purchase) => <div key={purchase.id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/70"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-gray-900 dark:text-gray-100">{purchase.customerName}</p><p className="text-xs text-gray-500 dark:text-gray-400">{phone(purchase.customerPhone)}</p></div><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-100">{purchase.redeemedAt ? 'Redeemed' : purchase.status}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"><span className="font-mono font-bold tracking-[0.2em] text-gray-900 dark:text-gray-100">{purchase.redemptionCode ?? 'PENDING'}</span><span>{dateTime(purchase.purchasedAt)}</span><span>{cents(purchase.totalAmount)}</span></div><div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">{purchase.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3"><span>{item.serviceName}</span><span>{cents(item.discountedUnitAmount)}</span></div>)}</div><div className="mt-3 flex flex-wrap items-center gap-2"><a href={`/deal-purchases/${purchase.token}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">Open receipt</a>{purchase.stripeReceiptUrl && <a href={purchase.stripeReceiptUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">Stripe receipt</a>}<button type="button" onClick={() => { setRedeemingPurchaseId(purchase.id); redeemMutation.mutate({ purchaseId: purchase.id }); }} disabled={redeemingPurchaseId !== null || Boolean(purchase.redeemedAt)} className="text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60">{purchase.redeemedAt ? 'Already redeemed' : redeemingPurchaseId === purchase.id ? 'Redeeming...' : 'Redeem now'}</button></div></div>)}</div>}</section><section className="space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">Sent Recipients</h3><span className="text-xs text-gray-400 dark:text-gray-500">{deal.notificationSends.length}</span></div>{deal.notificationSends.length === 0 ? <p className="text-xs text-gray-400 dark:text-gray-500">No deal texts sent yet.</p> : <div className="max-h-80 space-y-2 overflow-y-auto pr-1">{deal.notificationSends.map((send) => <div key={send.id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/70"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-gray-900 dark:text-gray-100">{send.customerName?.trim() || 'Unnamed customer'}</p><p className="text-xs text-gray-500 dark:text-gray-400">{phone(send.customerPhone)}</p></div><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${send.status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{send.status}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"><span>{dateTime(send.createdAt)}</span>{send.code ? <span className="font-mono font-bold tracking-[0.2em] text-gray-900 dark:text-gray-100">{send.code}</span> : <span>Purchase link sent</span>}</div>{send.errorMessage && send.status !== 'sent' && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{send.errorMessage}</p>}</div>)}</div>}{deal.deliveryType === 'code_claim' && <div className="space-y-2 rounded-2xl border border-gray-100 p-3 dark:border-gray-700"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">Legacy claim codes</p>{deal.redemptions.length === 0 ? <p className="text-xs text-gray-400 dark:text-gray-500">No codes claimed yet.</p> : deal.redemptions.map((redemption) => <div key={redemption.id} className="flex items-center justify-between text-xs"><span className="font-mono font-bold tracking-[0.2em] text-gray-900 dark:text-gray-100">{redemption.code}</span><span className={redemption.usedAt ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>{redemption.usedAt ? 'Used' : 'Pending'}</span></div>)}</div>}</section></div></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
