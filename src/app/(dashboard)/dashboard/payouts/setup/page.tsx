'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EmbeddedPayoutWorkspace,
  type ConnectData,
  formatRequirementLabel,
  formatSchedule,
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
  const requirementList = [
    ...new Set([
      ...(connectData?.requirements.currentlyDue ?? []),
      ...(connectData?.requirements.pastDue ?? []),
      ...(connectData?.requirements.pendingVerification ?? []),
    ]),
  ];
  const needsSetup = !connectData?.readyForPaidDeals;

  return (
    <div className="max-w-6xl space-y-6 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Link href="/dashboard/payouts" className="inline-flex items-center text-sm text-primary hover:underline">
            Back to payouts
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Secure setup
            </p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
              Manage payout setup and payout preferences
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              This secure Stripe-powered screen handles identity verification, bank setup,
              compliance updates, payout schedule changes, and payout requests in one place.
            </p>
          </div>
        </div>

        <button type="button" onClick={() => void refreshConnect()} className="btn-outline text-sm">
          Refresh status
        </button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.8fr,1.2fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Setup status
            </p>
            <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {connectLoading
                ? 'Checking Stripe requirements...'
                : needsSetup
                  ? 'More setup is still required'
                  : 'Paid deal payouts are fully live'}
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {connectLoading
                ? 'Loading your current payout readiness.'
                : needsSetup
                  ? 'Complete the items below so purchase-link deals can go live without payout issues.'
                  : 'Your bank connection and payout controls are ready to manage here.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Bank account
              </p>
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {connectData?.externalAccount
                  ? `${connectData.externalAccount.bankName ?? 'Bank account'} ending in ${connectData.externalAccount.last4}`
                  : 'Not connected yet'}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {connectData?.externalAccount?.accountHolderName ||
                  'Stripe collects and stores bank details securely.'}
              </p>
            </div>

            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Payout schedule
              </p>
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {formatSchedule(connectData?.payoutSchedule ?? null)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Manual payouts can be changed to automatic weekly or monthly payouts in Stripe.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Available balance
              </p>
              <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {connectLoading ? '...' : cents(availableBalance)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Ready for payout in Stripe
              </p>
            </div>

            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Pending balance
              </p>
              <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {connectLoading ? '...' : cents(pendingBalance)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Sales still clearing through Stripe
              </p>
            </div>
          </div>

          {requirementList.length > 0 && (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/30 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Stripe still needs a few items
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {requirementList.slice(0, 10).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    {formatRequirementLabel(item)}
                  </span>
                ))}
              </div>
              {connectData?.requirements.disabledReason && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  Status from Stripe: {connectData.requirements.disabledReason}
                </p>
              )}
            </div>
          )}
        </div>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Stripe workspace
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Complete onboarding and manage payouts here
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The Stripe workspace opens immediately on this page so the secure setup flow is
              always in view instead of appearing farther down the payouts dashboard.
            </p>
          </div>

          <EmbeddedPayoutWorkspace
            visible
            onboardingComplete={Boolean(connectData?.onboardingComplete)}
            onRefresh={refreshConnect}
          />
        </section>
      </section>
    </div>
  );
}
