'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DatePicker } from '@/components/ui/DatePicker';
import InStoreCapturePanel from '@/components/campaigns/InStoreCapturePanel';
import {
  addDays,
  fromDateOnlyValue,
  isDealEndSameOrBeforeStart,
  isDealStartBeforeToday,
  toDateOnlyValue,
} from '@/lib/deal-dates';

interface Deal {
  id: string;
  title: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  serviceId: string | null;
  service: { name: string } | null;
  startsAt: string;
  expiresAt: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
  createdAt: string;
  notifiedAt: string | null;
  platformFeePercent: number;
  revenueTracked: number;
  platformFeesOwed: number;
  redemptions: { id: string; code: string; createdAt: string; usedAt: string | null; transactionAmount: number | null; platformFee: number | null }[];
  notificationSends: {
    id: string;
    createdAt: string;
    customerId: string | null;
    customerName: string | null;
    customerPhone: string;
    code: string;
    status: string;
    errorMessage: string | null;
  }[];
}

function discountLabel(deal: Deal) {
  if (deal.discountType === 'percent_off') return `${deal.discountValue}% off`;
  if (deal.discountType === 'amount_off') return `$${deal.discountValue} off`;
  return 'Free service';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function createDefaultForm() {
  const today = new Date();
  return {
    title: '',
    description: '',
    discountType: 'percent_off',
    discountValue: '',
    serviceId: '',
    startsAt: toDateOnlyValue(today),
    expiresAt: toDateOnlyValue(addDays(today, 1)),
    maxRedemptions: '',
  };
}

export default function DealsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(createDefaultForm);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmingNotify, setConfirmingNotify] = useState<string | null>(null);
  const [sendingNotifyId, setSendingNotifyId] = useState<string | null>(null);

  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => { const res = await fetch('/api/deals'); if (!res.ok) throw new Error(); return res.json(); },
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: async () => { const res = await fetch('/api/services'); if (!res.ok) throw new Error(); return res.json(); },
  });

  const { data: businessData } = useQuery({
    queryKey: ['business'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error();
      return res.json();
    },
  });

  const deals: Deal[] = (dealsData?.deals ?? []).map((deal: any) => ({
    ...deal,
    redemptions: deal.redemptions ?? [],
    notificationSends: deal.notificationSends ?? [],
  }));
  const services: { id: string; name: string }[] = servicesData?.services || [];
  const business: { name: string; publicId: string } | null = businessData?.business
    ? {
        name: businessData.business.name,
        publicId: businessData.business.publicId,
      }
    : null;

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          discountValue: data.discountType === 'free_service' ? 0 : Number(data.discountValue),
          maxRedemptions: data.maxRedemptions ? Number(data.maxRedemptions) : null,
          serviceId: data.serviceId || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setForm(createDefaultForm());
      setShowForm(false);
      toast.success('Deal created!');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create deal'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
    onError: () => toast.error('Failed to update deal'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setConfirmDelete(null);
      toast.success('Deal deleted');
    },
    onError: () => toast.error('Failed to delete deal'),
  });

  const notifyMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const res = await fetch(`/api/deals/${dealId}/notify`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json() as Promise<{ sent: number; skipped?: number; alreadySent?: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      const alreadySent = data.alreadySent ?? 0;
      const skipped = data.skipped ?? 0;
      if (data.sent === 0 && alreadySent > 0 && skipped === 0) {
        toast.success(
          `No new texts sent. ${alreadySent} customer${alreadySent !== 1 ? 's already' : ' already'} received this deal.`
        );
      } else if (data.sent === 0 && skipped > 0 && alreadySent > 0) {
        toast.success(
          `${alreadySent} customer${alreadySent !== 1 ? 's already' : ' already'} received this deal. ${skipped} recipient${skipped !== 1 ? 's could not' : ' could not'} be issued a new code.`
        );
      } else if (data.sent === 0 && skipped > 0) {
        toast.success('No texts sent because this deal has no remaining personalized codes.');
      } else if (data.sent === 0) {
        toast.success('No customers have opted in to receive texts yet');
      } else if (alreadySent > 0 && skipped > 0) {
        toast.success(
          `Sent ${data.sent} new personalized code${data.sent !== 1 ? 's' : ''}. ${alreadySent} customer${alreadySent !== 1 ? 's already' : ' already'} received this deal, and ${skipped} recipient${skipped !== 1 ? 's could not' : ' could not'} be issued a new code.`
        );
      } else if (alreadySent > 0) {
        toast.success(
          `Sent ${data.sent} new personalized code${data.sent !== 1 ? 's' : ''}. ${alreadySent} customer${alreadySent !== 1 ? 's already' : ' already'} received this deal.`
        );
      } else if (skipped > 0) {
        toast.success(
          `Sent ${data.sent} new personalized code${data.sent !== 1 ? 's' : ''}. Skipped ${skipped} recipient${skipped !== 1 ? 's' : ''}.`
        );
      } else {
        toast.success(`Sent ${data.sent} new personalized code${data.sent !== 1 ? 's' : ''}!`);
      }
    },
    onError: (e: any) => toast.error(e.message || 'Failed to send texts'),
    onSettled: () => setSendingNotifyId(null),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.startsAt || !form.expiresAt) { toast.error('Fill in all required fields'); return; }
    if (isDealStartBeforeToday(form.startsAt)) {
      toast.error('Start date cannot be earlier than today');
      return;
    }
    if (isDealEndSameOrBeforeStart(form.startsAt, form.expiresAt)) {
      toast.error('End date must be at least one day after start date');
      return;
    }
    createMutation.mutate(form);
  };

  const closeForm = () => {
    if (!createMutation.isPending) {
      setShowForm(false);
    }
  };

  useEffect(() => {
    if (!showForm) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeForm();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showForm, createMutation.isPending]);

  const labelClass = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1';
  const minimumEndDate = addDays(fromDateOnlyValue(form.startsAt) ?? new Date(), 1);

  return (
    <div
      data-testid="deals-page"
      className="max-w-7xl space-y-4 sm:space-y-6 pb-28 md:pb-8"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Deals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create time-limited promotions that appear on your booking page.</p>
        </div>
        <button
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
          className="btn-primary text-sm shrink-0 flex items-center gap-1.5"
        >
          {showForm ? (
            'Close'
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Deal</span>
            </>
          )}
        </button>
      </div>

      <InStoreCapturePanel business={business} deals={deals} />

      {/* Create form */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={closeForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-deal-modal-title"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:max-w-3xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card border-0 bg-transparent p-5 shadow-none md:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">New deal</p>
                  <h2 id="new-deal-modal-title" className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                    Create a new promotion
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  aria-label="Close new deal modal"
                  className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Title <span className="text-red-500">*</span></label>
                  <input
                    className="input text-sm"
                    placeholder="e.g. 20% off gel manicure this week"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Discount Type <span className="text-red-500">*</span></label>
                  <select className="input text-sm" value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))}>
                    <option value="percent_off">% off</option>
                    <option value="amount_off">$ off</option>
                    <option value="free_service">Free service</option>
                  </select>
                </div>

                {form.discountType !== 'free_service' && (
                  <div>
                    <label className={labelClass}>
                      {form.discountType === 'percent_off' ? 'Percent off' : 'Amount off ($)'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="input text-sm"
                      type="number"
                      min="0"
                      step={form.discountType === 'percent_off' ? '1' : '0.01'}
                      max={form.discountType === 'percent_off' ? '100' : undefined}
                      placeholder={form.discountType === 'percent_off' ? '20' : '10.00'}
                      value={form.discountValue}
                      onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Applies to service (optional)</label>
                  <select className="input text-sm" value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
                    <option value="">Any service</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Max redemptions (optional)</label>
                  <input
                    className="input text-sm"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={form.maxRedemptions}
                    onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                  />
                </div>

                <div>
                  <label className={labelClass}>Start date <span className="text-red-500">*</span></label>
                  <DatePicker
                    value={fromDateOnlyValue(form.startsAt)}
                    onChange={(date) =>
                      setForm((currentForm) => {
                        const startsAt = toDateOnlyValue(date);
                        const currentEndDate = fromDateOnlyValue(currentForm.expiresAt);
                        const nextMinimumEndDate = addDays(date, 1);

                        return {
                          ...currentForm,
                          startsAt,
                          expiresAt:
                            !currentEndDate || isDealEndSameOrBeforeStart(date, currentEndDate)
                              ? toDateOnlyValue(nextMinimumEndDate)
                              : currentForm.expiresAt,
                        };
                      })
                    }
                    minDate={new Date()}
                    placeholder="Select start date"
                  />
                </div>

                <div>
                  <label className={labelClass}>End date <span className="text-red-500">*</span></label>
                  <DatePicker
                    value={fromDateOnlyValue(form.expiresAt)}
                    onChange={(date) => setForm(f => ({ ...f, expiresAt: toDateOnlyValue(date) }))}
                    minDate={minimumEndDate}
                    placeholder="Select end date"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Description (optional)</label>
                  <input
                    className="input text-sm"
                    placeholder="Any additional details for the customer"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeForm} className="btn-outline text-sm" disabled={createMutation.isPending}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary text-sm">
                  {createMutation.isPending ? 'Creating...' : 'Create Deal'}
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Deals list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
      ) : deals.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 8V5a2 2 0 012-2h2z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No deals yet. Create your first deal with the New Deal button.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map(deal => {
            const isExpired = new Date(deal.expiresAt) <= new Date();
            const isFull = deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions;
            const isExpanded = expandedDeal === deal.id;
            const isSendingThisDeal = sendingNotifyId === deal.id;
            const notifyButtonsDisabled = sendingNotifyId !== null;

            return (
              <div key={deal.id} className="card overflow-hidden">
                <div className="p-4 md:p-5">
                  {/* Top row: badge + status tags */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap">
                        {discountLabel(deal)}
                      </span>
                      {isExpired && <span className="text-xs text-red-500 font-medium">Expired</span>}
                      {isFull && !isExpired && <span className="text-xs text-gray-400 font-medium">Max reached</span>}
                    </div>

                    {/* Toggle + Delete - always top-right */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => toggleMutation.mutate({ id: deal.id, active: !deal.active })}
                        title={deal.active ? 'Active - click to deactivate' : 'Inactive - click to activate'}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${deal.active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${deal.active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>

                      {confirmDelete === deal.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => deleteMutation.mutate(deal.id)} disabled={deleteMutation.isPending} className="text-xs text-red-600 font-semibold hover:underline">Delete</button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(deal.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-1.5">
                    {deal.title}
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <span>{deal.service?.name ?? 'Any service'}</span>
                    <span className="text-gray-300 dark:text-gray-600">-</span>
                    <span>{fmtDateShort(deal.startsAt)} - {fmtDateShort(deal.expiresAt)}</span>
                    <span className="text-gray-300 dark:text-gray-600">-</span>
                    <span>{deal.redemptionCount}{deal.maxRedemptions ? ` / ${deal.maxRedemptions}` : ''} claimed</span>
                  </div>

                  {/* Revenue stats */}
                  {deal.revenueTracked > 0 && (
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span>Revenue tracked: <span className="font-semibold text-gray-700 dark:text-gray-300">${deal.revenueTracked.toFixed(2)}</span></span>
                      <span className="text-gray-300 dark:text-gray-600">-</span>
                      <span>Platform fees: <span className="font-semibold text-gray-700 dark:text-gray-300">${deal.platformFeesOwed.toFixed(2)}</span></span>
                    </div>
                  )}

                  {/* Bottom row: codes button + notify button */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button
                      onClick={() => setExpandedDeal(isExpanded ? null : deal.id)}
                      className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                    >
                      {isExpanded ? 'Hide activity' : 'View activity'}
                    </button>

                    {deal.active && (
                      confirmingNotify === deal.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Send each opted-in customer a personalized redemption code by text?</span>
                          <button
                            onClick={() => {
                              if (sendingNotifyId !== null) return;
                              setSendingNotifyId(deal.id);
                              setConfirmingNotify(null);
                              notifyMutation.mutate(deal.id);
                            }}
                            disabled={sendingNotifyId !== null}
                            className="text-xs font-semibold text-white bg-primary px-2.5 py-1 rounded-lg hover:bg-primary/90 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Yes, send
                          </button>
                          <button
                            onClick={() => setConfirmingNotify(null)}
                            disabled={sendingNotifyId !== null}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={() => setConfirmingNotify(deal.id)}
                            disabled={notifyButtonsDisabled}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {isSendingThisDeal ? 'Sending...' : 'Text My Customers'}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Expanded codes */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 md:px-5 py-4">
                    <div className="grid gap-5 xl:grid-cols-2">
                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                            Personalized Codes
                          </h3>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {deal.redemptions.length}
                          </span>
                        </div>

                        {deal.redemptions.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500">No codes claimed yet.</p>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pb-1">
                              <span>Code</span>
                              <span>Claimed</span>
                              <span>Status</span>
                            </div>
                            {deal.redemptions.map(r => (
                              <div key={r.id} className="grid grid-cols-3 text-xs py-1.5 border-t border-gray-100 dark:border-gray-700/50">
                                <span className="font-mono font-bold text-gray-900 dark:text-gray-100 tracking-widest">{r.code}</span>
                                <span className="text-gray-500 dark:text-gray-400">{fmtDateShort(r.createdAt)}</span>
                                <span>{r.usedAt
                                  ? <span className="text-green-600 dark:text-green-400 font-semibold">Used</span>
                                  : <span className="text-gray-400">Pending</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
                            Sent Recipients
                          </h3>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {deal.notificationSends.length}
                          </span>
                        </div>

                        {deal.notificationSends.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500">No deal texts sent yet.</p>
                        ) : (
                          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                            {deal.notificationSends.map((send) => (
                              <div
                                key={send.id}
                                className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/70"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                                      {send.customerName?.trim() || 'Unnamed customer'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {fmtPhone(send.customerPhone)}
                                    </p>
                                  </div>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                                      send.status === 'sent'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    }`}
                                  >
                                    {send.status}
                                  </span>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="font-mono font-bold tracking-[0.2em] text-gray-900 dark:text-gray-100">
                                    {send.code}
                                  </span>
                                  <span>{fmtDateTime(send.createdAt)}</span>
                                </div>

                                {send.errorMessage && send.status !== 'sent' && (
                                  <p className="mt-2 text-xs text-red-600 dark:text-red-300">{send.errorMessage}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
