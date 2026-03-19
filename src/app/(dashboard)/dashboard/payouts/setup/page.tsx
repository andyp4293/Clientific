'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EmbeddedPayoutWorkspace,
  type ConnectData,
  formatRequirementStatus,
  formatSchedule,
  summarizeRequirementTasks,
  sumBalanceAmounts,
} from '@/components/payouts/EmbeddedPayoutWorkspace';

const cents = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);

export default function PayoutsSetupPage() {
  const queryClient = useQueryClient();

  const {
    data: connectData,
    isLoading: connectLoading,
    refetch: refetchConnect,
  } = useQuery<ConnectData>({
    queryKey: ['connect-payouts'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/connect/payouts');
      if (!res.ok) throw new Error('Failed to load payout status');
      return res.json();
    },
  });

  const refreshConnect = async () => {
    await refetchConnect();
    await queryClient.invalidateQueries({ queryKey: ['connect-payouts'] });
  };

  const availableBalance = sumBalanceAmounts(connectData?.balances?.available);
  const pendingBalance = sumBalanceAmounts(connectData?.balances?.pending);
  const rawRequirementList = [
    ...new Set([
      ...(connectData?.requirements.currentlyDue ?? []),
      ...(connectData?.requirements.pastDue ?? []),
      ...(connectData?.requirements.pendingVerification ?? []),
    ]),
  ];
  const requirementTasks = summarizeRequirementTasks(rawRequirementList);
  const requirementStatus = formatRequirementStatus(connectData?.requirements.disabledReason);
  const needsSetup = !connectData?.readyForPaidDeals;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/dashboard/payouts"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <span aria-hidden="true">&larr;</span>
            Back to payouts
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Secure setup
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Finish payout setup
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              Complete the remaining Stripe steps below so paid deals can go live.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refreshConnect()}
          className="btn-outline text-sm"
        >
          Refresh status
        </button>
      </div>

      {(requirementTasks.length > 0 || requirementStatus || needsSetup) && (
        <section className="brand-panel rounded-[28px] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {connectLoading
                  ? 'Checking setup requirements...'
                  : needsSetup
                    ? 'Complete these steps to enable paid deals'
                    : 'Payout setup is ready'}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {needsSetup
                  ? 'Use the secure Stripe form below to finish setup.'
                  : 'You can still review payout details or make updates below.'}
              </p>
            </div>
            {!needsSetup && (
              <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary dark:bg-primary/15">
                Ready
              </div>
            )}
          </div>

          {requirementTasks.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {requirementTasks.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {requirementStatus ? (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{requirementStatus}</p>
          ) : null}
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px]">
        <div className="brand-panel rounded-[28px] p-3 sm:p-4">
          <EmbeddedPayoutWorkspace
            visible
            onboardingComplete={Boolean(connectData?.onboardingComplete)}
            onRefresh={refreshConnect}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="brand-panel rounded-[24px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Setup status
            </p>
            <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {connectLoading
                ? 'Checking requirements...'
                : needsSetup
                  ? 'More setup is still required'
                  : 'Paid deal payouts are live'}
            </p>
          </div>

          <div className="brand-panel rounded-[24px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Bank account
            </p>
            <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {connectData?.externalAccount
                ? `${connectData.externalAccount.bankName ?? 'Bank account'} ending in ${connectData.externalAccount.last4}`
                : 'Not connected yet'}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {connectData?.externalAccount?.accountHolderName ||
                'Stripe securely stores bank details for payouts.'}
            </p>
          </div>

          {!needsSetup && (
            <>
              <div className="brand-panel rounded-[24px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Available balance
                </p>
                <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {connectLoading ? '...' : cents(availableBalance)}
                </p>
              </div>

              <div className="brand-panel rounded-[24px] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Payout schedule
                </p>
                <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatSchedule(connectData?.payoutSchedule ?? null)}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  Pending balance: {connectLoading ? '...' : cents(pendingBalance)}
                </p>
              </div>
            </>
          )}
        </aside>
      </section>
    </div>
  );
}
