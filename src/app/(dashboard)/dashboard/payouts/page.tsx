'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

type PayoutRecord = {
  id: string;
  amount: number;
  currency: string;
  arrivalDate: number;
  status: string;
  bankLast4: string | null;
  bankName: string | null;
};

type PayoutsData = {
  notConnected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  balances: {
    available: { amount: number; currency: string }[];
    pending: { amount: number; currency: string }[];
  } | null;
  payouts: PayoutRecord[];
};

type Transaction = {
  id: string;
  dealTitle: string;
  customerName: string;
  customerPhone: string;
  purchasedAt: string | null;
  totalAmount: number;
  applicationFeeAmount: number;
  businessNetAmount: number;
  status: string;
  redeemedAt: string | null;
  redemptionCode: string | null;
};

type EarningsData = {
  transactions: Transaction[];
  totals: {
    totalGross: number;
    totalFees: number;
    totalNet: number;
    transactionCount: number;
  };
};

const cents = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const arrivalDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const phone = (value: string) => {
  const d = value.replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1')
    ? `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
    : d.length === 10
      ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
      : value;
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'in_transit':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'failed':
    case 'canceled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'redeemed':
      return 'bg-primary/10 text-primary';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

export default function PayoutsPage() {
  const { data: payoutsData, isLoading: payoutsLoading } = useQuery<PayoutsData>({
    queryKey: ['connect-payouts'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/connect/payouts');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: earningsData, isLoading: earningsLoading } = useQuery<EarningsData>({
    queryKey: ['deal-earnings'],
    queryFn: async () => {
      const res = await fetch('/api/deal-purchases/earnings');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const totals = earningsData?.totals;
  const transactions = earningsData?.transactions ?? [];
  const payouts = payoutsData?.payouts ?? [];
  const balances = payoutsData?.balances;

  return (
    <div className="max-w-7xl space-y-6 pb-28 md:pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payouts</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track your earnings, platform fees, and Stripe payouts.
        </p>
      </div>

      {/* No bank account prompt */}
      {!payoutsLoading && payoutsData && !payoutsData.payoutsEnabled && (
        <div className="card border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Add a bank account to receive payouts
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Go to Settings → Payout Account to connect your bank routing and account number. Payouts are sent weekly.
              </p>
            </div>
            <Link href="/dashboard/settings" className="btn-primary text-sm">
              Go to Settings
            </Link>
          </div>
        </div>
      )}

      {/* Balance summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Available balance
          </p>
          {payoutsLoading ? (
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ) : (
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {balances?.available?.[0] ? cents(balances.available[0].amount) : '$0.00'}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Ready to pay out</p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Pending balance
          </p>
          {payoutsLoading ? (
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ) : (
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {balances?.pending?.[0] ? cents(balances.pending[0].amount) : '$0.00'}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Processing (2–7 days)</p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Total earned
          </p>
          {earningsLoading ? (
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ) : (
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {cents(totals?.totalNet ?? 0)}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">After platform fees</p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Platform fees paid
          </p>
          {earningsLoading ? (
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          ) : (
            <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {cents(totals?.totalFees ?? 0)}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            15% per deal purchase
          </p>
        </div>
      </div>

      {/* Payout history */}
      <section className="card p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Stripe payouts</p>
            <h2 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">Payout history</h2>
          </div>
        </div>

        {payoutsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {payoutsData?.payoutsEnabled
              ? 'No payouts yet. Payouts arrive automatically on Mondays.'
              : 'Add a bank account in Settings → Payout Account to start receiving payouts.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Amount</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Status</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Arrival date</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {cents(payout.amount)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(payout.status)}`}
                      >
                        {payout.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {arrivalDate(payout.arrivalDate)}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {payout.bankName ? `${payout.bankName} ···· ${payout.bankLast4}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Transaction history */}
      <section className="card p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Earnings</p>
            <h2 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">Transaction history</h2>
          </div>
          {totals && totals.transactionCount > 0 && (
            <p className="text-xs text-gray-400">
              {totals.transactionCount} sale{totals.transactionCount !== 1 ? 's' : ''}
              {' · '}
              {cents(totals.totalGross)} gross
            </p>
          )}
        </div>

        {earningsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No deal purchases yet. When customers buy your deals, transactions will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Customer</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 hidden sm:table-cell">Deal</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 hidden md:table-cell">Date</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Gross</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 hidden lg:table-cell">Fee (15%)</th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Net</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{tx.customerName}</p>
                      <p className="text-xs text-gray-400">{phone(tx.customerPhone)}</p>
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {tx.dealTitle}
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {shortDate(tx.purchasedAt)}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {cents(tx.totalAmount)}
                    </td>
                    <td className="py-3 text-right text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      -{cents(tx.applicationFeeAmount)}
                    </td>
                    <td className="py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {cents(tx.businessNetAmount)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(tx.status)}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                  <td colSpan={3} className="pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Total</td>
                  <td colSpan={3} className="pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Total</td>
                  <td className="pt-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                    {cents(totals?.totalGross ?? 0)}
                  </td>
                  <td className="pt-3 text-right text-gray-500 hidden lg:table-cell">
                    -{cents(totals?.totalFees ?? 0)}
                  </td>
                  <td className="pt-3 text-right font-bold text-primary">
                    {cents(totals?.totalNet ?? 0)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
