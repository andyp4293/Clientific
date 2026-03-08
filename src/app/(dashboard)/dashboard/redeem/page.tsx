'use client';

import { useState } from 'react';

type State = 'idle' | 'preview' | 'success';

interface LookupResult {
  deal: { title: string; discountType: string; discountValue: number; platformFeePercent: number };
  customer: { name: string; phone: string } | null;
  alreadyUsed: boolean;
}

interface RedeemResult {
  success: boolean;
  deal: { title: string; discountType: string; discountValue: number };
  customer: { name: string; phone: string } | null;
  platformFee: number | null;
}

function discountLabel(type: string, value: number): string {
  if (type === 'percent_off') return `${value}% off`;
  if (type === 'amount_off') return `$${value.toFixed(2)} off`;
  return 'Free service';
}

export default function RedeemPage() {
  const [state, setState] = useState<State>('idle');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);

  const reset = () => {
    setState('idle');
    setCode('');
    setError('');
    setTransactionAmount('');
    setLookup(null);
    setResult(null);
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to look up code');
      setLookup(data);
      setState('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!lookup) return;
    setError('');
    setLoading(true);
    try {
      const body: Record<string, unknown> = { code };
      if (transactionAmount) body.transactionAmount = parseFloat(transactionAmount);
      const res = await fetch('/api/deals/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to redeem code');
      setResult(data);
      setState('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-8 px-4 pb-16">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Redeem a Deal</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Enter the customer's deal code to mark it as used.</p>

      {/* Idle — code entry */}
      {state === 'idle' && (
        <form onSubmit={handleLookup} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Deal Code
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="e.g. AB3DEF7G"
              className="block w-full font-mono text-2xl tracking-widest text-center rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:text-gray-100 uppercase"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 1}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Looking up...' : 'Look Up Code'}
          </button>
        </form>
      )}

      {/* Preview */}
      {state === 'preview' && lookup && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-5">
          {/* Deal info */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Deal</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{lookup.deal.title}</p>
            <span className="inline-block mt-1 text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
              {discountLabel(lookup.deal.discountType, lookup.deal.discountValue)}
            </span>
          </div>

          {/* Customer */}
          {lookup.customer && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Customer</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{lookup.customer.name}</p>
              {lookup.customer.phone && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{lookup.customer.phone}</p>
              )}
            </div>
          )}

          {/* Already used warning */}
          {lookup.alreadyUsed && (
            <div className="px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400 font-medium">
              This code has already been redeemed.
            </div>
          )}

          {/* Transaction amount (only if not already used) */}
          {!lookup.alreadyUsed && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Sale Amount (optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={transactionAmount}
                  onChange={e => setTransactionAmount(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 dark:border-gray-700 pl-7 pr-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Enter the total sale to track platform fee ({lookup.deal.platformFeePercent}%).
              </p>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRedeem}
              disabled={loading || lookup.alreadyUsed}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Confirming...' : 'Confirm Redemption'}
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {state === 'success' && result && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Redeemed!</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{result.deal.title}</p>
            {result.customer && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{result.customer.name}</p>
            )}
          </div>

          {result.platformFee !== null && (
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2">
              Platform fee recorded: <span className="font-semibold text-gray-900 dark:text-gray-100">${result.platformFee.toFixed(2)}</span>
            </p>
          )}

          <button
            onClick={reset}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors mt-2"
          >
            Redeem Another
          </button>
        </div>
      )}
    </div>
  );
}
