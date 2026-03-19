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
      <section className="overflow-hidden rounded-[32px] brand-hero p-6 text-white shadow-[0_36px_90px_-44px_rgba(6,17,24,0.7)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Link
              href="/dashboard/payouts"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition hover:text-white"
            >
              <span aria-hidden="true">&larr;</span>
              Back to payouts
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                Secure setup
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
                Finish payout onboarding in one focused workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75 sm:text-base">
                Bank setup, identity verification, payout scheduling, and payout requests all
                happen in the secure Stripe workspace below. We moved it to the main stage so
                the critical action is always front and center.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void refreshConnect()}
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Refresh status
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Setup status
            </p>
            <p className="mt-2 text-lg font-semibold">
              {connectLoading
                ? 'Checking requirements...'
                : needsSetup
                  ? 'More setup is still required'
                  : 'Paid deal payouts are live'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Available balance
            </p>
            <p className="mt-2 text-lg font-semibold">
              {connectLoading ? '...' : cents(availableBalance)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Payout schedule
            </p>
            <p className="mt-2 text-lg font-semibold">
              {formatSchedule(connectData?.payoutSchedule ?? null)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.22fr,0.78fr]">
        <div className="space-y-4">
          <div className="brand-panel rounded-[32px] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Stripe workspace
            </p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Complete onboarding and manage payouts here
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  This secure area is now the primary focus of the page so setup, verification,
                  and payout controls are immediately visible instead of feeling tucked away.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-gray-700 dark:border-primary/20 dark:bg-primary/10 dark:text-gray-100">
                Powered by Stripe
              </div>
            </div>
          </div>

          <div className="brand-panel rounded-[32px] p-3 sm:p-4">
            <EmbeddedPayoutWorkspace
              visible
              onboardingComplete={Boolean(connectData?.onboardingComplete)}
              onRefresh={refreshConnect}
            />
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="brand-panel rounded-[28px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Next step
            </p>
            <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {needsSetup ? 'Complete setup, then publish paid deals' : 'Your payout controls are ready'}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {needsSetup
                ? 'Finish the remaining setup items here before purchase-link deals go live.'
                : 'You can review balance activity, request payouts, and adjust payout timing from this workspace.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="brand-panel rounded-[28px] p-5">
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

            <div className="brand-panel rounded-[28px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Pending balance
              </p>
              <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {connectLoading ? '...' : cents(pendingBalance)}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                Sales still clearing through Stripe before they move into the available balance.
              </p>
            </div>
          </div>

          {(requirementTasks.length > 0 || requirementStatus) && (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/30 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Finish these setup steps before paid deals go live
              </p>
              {requirementTasks.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {requirementTasks.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm dark:bg-amber-950/30 dark:text-amber-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                The secure Stripe form walks the business through the exact details that still
                need attention.
              </p>
              {requirementStatus ? (
                <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                  {requirementStatus}
                </p>
              ) : null}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
