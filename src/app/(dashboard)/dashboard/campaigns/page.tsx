'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  redemptions: { id: string; code: string; createdAt: string; usedAt: string | null }[];
}

function discountLabel(deal: Deal) {
  if (deal.discountType === 'percent_off') return `${deal.discountValue}% off`;
  if (deal.discountType === 'amount_off') return `$${deal.discountValue} off`;
  return 'Free service';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const defaultForm = {
  title: '',
  description: '',
  discountType: 'percent_off',
  discountValue: '',
  serviceId: '',
  startsAt: new Date().toLocaleDateString('en-CA'),
  expiresAt: '',
  maxRedemptions: '',
};

export default function DealsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => { const res = await fetch('/api/deals'); if (!res.ok) throw new Error(); return res.json(); },
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: async () => { const res = await fetch('/api/services'); if (!res.ok) throw new Error(); return res.json(); },
  });

  const deals: Deal[] = dealsData?.deals || [];
  const services: { id: string; name: string }[] = servicesData?.services || [];

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.startsAt || !form.expiresAt) { toast.error('Fill in all required fields'); return; }
    createMutation.mutate(form);
  };

  const labelClass = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1';

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Deals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create time-limited promotions that appear on your booking page.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm">
          {showForm ? 'Cancel' : '+ New Deal'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-6">
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
                <input className="input text-sm" type="date" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} required />
              </div>

              <div>
                <label className={labelClass}>End date <span className="text-red-500">*</span></label>
                <input className="input text-sm" type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} required />
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
          {[1, 2].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />)}
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

            return (
              <div key={deal.id} className="card overflow-hidden">
                <div className="p-5 flex items-start gap-4">
                  <div className="flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap mt-0.5">
                    {discountLabel(deal)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{deal.title}</p>
                      {isExpired && <span className="text-xs text-red-500 font-medium">Expired</span>}
                      {isFull && !isExpired && <span className="text-xs text-gray-400 font-medium">Max reached</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {deal.service?.name ?? 'Any service'} · {fmtDate(deal.startsAt)} – {fmtDate(deal.expiresAt)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {deal.redemptionCount}{deal.maxRedemptions ? ` / ${deal.maxRedemptions}` : ''} claimed
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => setExpandedDeal(isExpanded ? null : deal.id)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      {isExpanded ? 'Hide codes' : `Codes (${deal.redemptions.length})`}
                    </button>

                    <button
                      onClick={() => toggleMutation.mutate({ id: deal.id, active: !deal.active })}
                      title={deal.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${deal.active ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${deal.active ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>

                    {confirmDelete === deal.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => deleteMutation.mutate(deal.id)} disabled={deleteMutation.isPending} className="text-xs text-red-600 font-medium hover:underline">Confirm</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
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

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                    {deal.redemptions.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">No codes claimed yet.</p>
                    ) : (
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            <th className="pb-2 pr-8 font-semibold">Code</th>
                            <th className="pb-2 pr-8 font-semibold">Claimed</th>
                            <th className="pb-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                          {deal.redemptions.map(r => (
                            <tr key={r.id}>
                              <td className="py-2 pr-8 font-mono font-bold text-gray-900 dark:text-gray-100 tracking-widest">{r.code}</td>
                              <td className="py-2 pr-8 text-gray-500 dark:text-gray-400">{fmtDate(r.createdAt)}</td>
                              <td className="py-2">{r.usedAt ? <span className="text-green-600 dark:text-green-400 font-medium">Used</span> : <span className="text-gray-400">Pending</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
