'use client';

import { buildPayoutFundsBreakdown } from '@/lib/payout-funds';

const cents = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);

export function FundsStatusPanel({
  availableAmountCents,
  stripePendingAmountCents,
  dealPendingAmountCents,
  dealPendingCount,
  referralPendingAmountCents,
  referralPendingCount,
  readyForPaidDeals,
  isLoading = false,
  className = '',
}: {
  availableAmountCents: number;
  stripePendingAmountCents: number;
  dealPendingAmountCents: number;
  dealPendingCount: number;
  referralPendingAmountCents: number;
  referralPendingCount: number;
  readyForPaidDeals: boolean;
  isLoading?: boolean;
  className?: string;
}) {
  const breakdown = buildPayoutFundsBreakdown({
    availableAmountCents,
    stripePendingAmountCents,
    dealPendingAmountCents,
    dealPendingCount,
    referralPendingAmountCents,
    referralPendingCount,
    readyForPaidDeals,
  });

  return (
    <section className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Funds status
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            See what can pay out now and what is still waiting.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Available now
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isLoading ? '...' : cents(breakdown.availableAmountCents)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {isLoading ? 'Checking cleared payout funds...' : breakdown.availableDescription}
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Still pending
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isLoading ? '...' : cents(breakdown.pendingAmountCents)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {isLoading ? 'Checking pending payout funds...' : breakdown.pendingDescription}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          Why funds are pending
        </p>

        {isLoading ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Loading fund explanations...
          </p>
        ) : breakdown.pendingReasons.length > 0 ? (
          <div className="mt-3 space-y-3">
            {breakdown.pendingReasons.map((reason) => (
              <div
                key={reason.id}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {reason.label}
                  </p>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {cents(reason.amountCents)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  {reason.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Nothing is waiting right now. New deal sales first clear through Stripe before they
            become available.
          </p>
        )}
      </div>
    </section>
  );
}
