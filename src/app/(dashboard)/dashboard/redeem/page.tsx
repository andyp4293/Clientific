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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:px-0">
      <section className="brand-hero rounded-[30px] border border-gray-200/80 p-6 shadow-[0_32px_90px_-50px_rgba(16,72,56,0.22)] dark:border-white/10 sm:p-7">
        <div className="max-w-2xl space-y-3">
          <p className="brand-hero-kicker text-xs font-semibold uppercase tracking-[0.28em]">Front desk redemption</p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
            Redeem a deal
          </h1>
          <p className="brand-hero-muted text-sm leading-6 sm:text-base">
            Look up a customer&apos;s code, review the offer, and confirm redemption in one clean flow.
          </p>
        </div>
      </section>

      {state === 'idle' && (
        <form onSubmit={handleLookup} className="card space-y-5 rounded-[28px] p-6 sm:p-7">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              Deal Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="e.g. AB3DEF7G"
              className="input block w-full rounded-[22px] border-gray-200/80 bg-white/80 px-4 py-4 text-center font-mono text-2xl tracking-[0.26em] uppercase shadow-[0_18px_45px_-32px_rgba(16,72,56,0.32)] dark:border-white/10 dark:bg-white/[0.05]"
              autoFocus
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || code.length < 1}
            className="btn-primary min-h-[52px] w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Looking up...' : 'Look Up Code'}
          </button>
        </form>
      )}

      {state === 'preview' && lookup ? (
        <div className="card space-y-5 rounded-[28px] p-6 sm:p-7">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              Deal
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{lookup.deal.title}</p>
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {discountLabel(lookup.deal.discountType, lookup.deal.discountValue)}
            </span>
          </div>

          {lookup.customer ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                Customer
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{lookup.customer.name}</p>
              {lookup.customer.phone ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">{lookup.customer.phone}</p>
              ) : null}
            </div>
          ) : null}

          {lookup.alreadyUsed ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
              This code has already been redeemed.
            </div>
          ) : null}

          {!lookup.alreadyUsed ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                Sale Amount (optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  className="input block w-full rounded-2xl border-gray-200/80 bg-white/80 py-3 pl-7 pr-3 dark:border-white/10 dark:bg-white/[0.05]"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Enter the total sale to track platform fee ({lookup.deal.platformFeePercent}%).
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3">
            <button onClick={reset} className="btn-outline min-h-[48px] flex-1">
              Cancel
            </button>
            <button
              onClick={handleRedeem}
              disabled={loading || lookup.alreadyUsed}
              className="btn-primary min-h-[48px] flex-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Confirming...' : 'Confirm Redemption'}
            </button>
          </div>
        </div>
      ) : null}

      {state === 'success' && result ? (
        <div className="card space-y-4 rounded-[28px] p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Redeemed!</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{result.deal.title}</p>
            {result.customer ? (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{result.customer.name}</p>
            ) : null}
          </div>

          {result.platformFee !== null ? (
            <p className="rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              Platform fee recorded:{' '}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                ${result.platformFee.toFixed(2)}
              </span>
            </p>
          ) : null}

          <button onClick={reset} className="btn-primary mt-2 min-h-[52px] w-full">
            Redeem Another
          </button>
        </div>
      ) : null}
    </div>
  );
}
