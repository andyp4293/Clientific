'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DatePicker } from '@/components/ui/DatePicker';
import InStoreCapturePanel from '@/components/campaigns/InStoreCapturePanel';

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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

const defaultForm = {
  title: '',
  description: '',
  discountType: 'percent_off',
  discountValue: '',
  serviceId: '',
  startsAt: toDateInputValue(new Date()),
  expiresAt: '',
  maxRedemptions: '',
};

export default function DealsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmingNotify, setConfirmingNotify] = useState<string | null>(null);

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

  const deals: Deal[] = dealsData?.deals || [];
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
      setForm(defaultForm);
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
      return res.json() as Promise<{ sent: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      if (data.sent === 0) {
        toast.success('No customers have opted in to receive texts yet');
      } else {
        toast.success(`Text sent to ${data.sent} customer${data.sent !== 1 ? 's' : ''}!`);
      }
    },
    onError: (e: any) => toast.error(e.message || 'Failed to send texts'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.startsAt || !form.expiresAt) { toast.error('Fill in all required fields'); return; }
    createMutation.mutate(form);
  };

  const labelClass = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1';
  const notifyCooldownMs = 7 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  return (
    <div className="p-4 md:p-6 max-w-4xl pb-28 md:pb-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Deals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create time-limited promotions that appear on your booking page.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm shrink-0 flex items-center gap-1.5">
          {showForm ? (
            'Cancel'
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Deal</span>
            </>
          )}
        </button>
      </div>

      <InStoreCapturePanel business={business} deals={deals} />

      {/* Create form */}
      {showForm && (
        <div className="card p-5 md:p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">New Deal</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  value={fromDateInputValue(form.startsAt)}
                  onChange={(date) => setForm(f => ({ ...f, startsAt: toDateInputValue(date) }))}
                  placeholder="Select start date"
                />
              </div>

              <div>
                <label className={labelClass}>End date <span className="text-red-500">*</span></label>
                <DatePicker
                  value={fromDateInputValue(form.expiresAt)}
                  onChange={(date) => setForm(f => ({ ...f, expiresAt: toDateInputValue(date) }))}
                  minDate={fromDateInputValue(form.startsAt) ?? undefined}
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

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary text-sm">
                {createMutation.isPending ? 'Creating…' : 'Create Deal'}
              </button>
            </div>
          </form>
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
          <p className="text-sm text-gray-500 dark:text-gray-400">No deals yet. Create your first deal above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map(deal => {
            const isExpired = new Date(deal.expiresAt) <= new Date();
            const isFull = deal.maxRedemptions !== null && deal.redemptionCount >= deal.maxRedemptions;
            const isExpanded = expandedDeal === deal.id;
            const notifiedAtMs = deal.notifiedAt ? new Date(deal.notifiedAt).getTime() : null;
            const notifyAvailableAtMs = notifiedAtMs ? notifiedAtMs + notifyCooldownMs : null;
            const notifyOnCooldown = notifyAvailableAtMs !== null && notifyAvailableAtMs > nowMs;
            const cooldownDaysRemaining = notifyOnCooldown
              ? Math.ceil((notifyAvailableAtMs - nowMs) / (24 * 60 * 60 * 1000))
              : 0;

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

                    {/* Toggle + Delete — always top-right */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => toggleMutation.mutate({ id: deal.id, active: !deal.active })}
                        title={deal.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
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
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span>{fmtDateShort(deal.startsAt)} – {fmtDateShort(deal.expiresAt)}</span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span>{deal.redemptionCount}{deal.maxRedemptions ? ` / ${deal.maxRedemptions}` : ''} claimed</span>
                  </div>

                  {/* Revenue stats */}
                  {deal.revenueTracked > 0 && (
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span>Revenue tracked: <span className="font-semibold text-gray-700 dark:text-gray-300">${deal.revenueTracked.toFixed(2)}</span></span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span>Platform fees: <span className="font-semibold text-gray-700 dark:text-gray-300">${deal.platformFeesOwed.toFixed(2)}</span></span>
                    </div>
                  )}

                  {/* Bottom row: codes button + notify button */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button
                      onClick={() => setExpandedDeal(isExpanded ? null : deal.id)}
                      className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                    >
                      {isExpanded ? 'Hide codes' : `View codes (${deal.redemptions.length})`}
                    </button>

                    {deal.active && (
                      confirmingNotify === deal.id && !notifyOnCooldown ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Send a text message to your opted-in customers?</span>
                          <button
                            onClick={() => { notifyMutation.mutate(deal.id); setConfirmingNotify(null); }}
                            className="text-xs font-semibold text-white bg-primary px-2.5 py-1 rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Yes, send
                          </button>
                          <button
                            onClick={() => setConfirmingNotify(null)}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={() => setConfirmingNotify(deal.id)}
                            disabled={notifyMutation.isPending || notifyOnCooldown}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {notifyMutation.isPending ? 'Sending...' : 'Text My Customers'}
                          </button>
                          {notifyOnCooldown && (
                            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              Cooldown: available in {cooldownDaysRemaining} day{cooldownDaysRemaining !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Expanded codes */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 md:px-5 py-4">
                    {deal.redemptions.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">No codes claimed yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {/* Header */}
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
