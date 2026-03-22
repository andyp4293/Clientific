'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  collectOutstandingRequirementKeys,
  EmbeddedPayoutWorkspace,
  type ConnectData,
  formatRequirementStatus,
  formatSchedule,
  summarizeRequirementTasks,
  summarizeRequirementGuidance,
} from '@/components/payouts/EmbeddedPayoutWorkspace';

export default function PayoutsSetupPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isStartingSetup, setIsStartingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

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

  const rawRequirementList = collectOutstandingRequirementKeys(connectData?.requirements);
  const requirementTasks = summarizeRequirementTasks(rawRequirementList);
  const requirementGuidance = summarizeRequirementGuidance(connectData);
  const requirementStatus = formatRequirementStatus(connectData?.requirements.disabledReason);
  const needsSetup = !connectData?.readyForPaidDeals;
  const onboardingState = searchParams.get('stripe_onboarding');
  const pageEyebrow = needsSetup ? 'Secure setup' : 'Payouts live';
  const pageTitle = needsSetup ? 'Finish payout setup' : 'Manage payouts';
  const pageDescription = needsSetup
    ? 'Complete the remaining Stripe steps below so payouts and paid deals can go live.'
    : 'Your payout account is live. Review balances, payouts, and payout settings below.';
  const bankAccountSummary = connectData?.externalAccount
    ? `${connectData.externalAccount.bankName ?? 'Bank account'} ending in ${connectData.externalAccount.last4}`
    : 'Bank account syncing';
  const payoutScheduleSummary = formatSchedule(connectData?.payoutSchedule ?? null);

  const startSetupLabel =
    onboardingState === 'return' ? 'Continue secure setup' : 'Start secure setup';

  const handleStartSetup = async () => {
    if (isStartingSetup) return;

    setIsStartingSetup(true);
    setSetupError(null);

    try {
      const res = await fetch('/api/stripe/connect/onboarding-link', {
        method: 'POST',
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body.url) {
        throw new Error(body.error || 'Could not start secure Stripe setup.');
      }

      window.location.assign(body.url as string);
    } catch (error: any) {
      setSetupError(error?.message || 'Could not start secure Stripe setup.');
      setIsStartingSetup(false);
    }
  };

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
              {pageEyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {pageTitle}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              {pageDescription}
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

          {requirementGuidance.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                What Stripe is still waiting on
              </p>
              <div className="mt-2 space-y-2 text-sm text-amber-800 dark:text-amber-300">
                {requirementGuidance.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          ) : null}

          {requirementStatus ? (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{requirementStatus}</p>
          ) : null}

          {onboardingState === 'return' && needsSetup ? (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
              We rechecked Stripe when you came back to Clientific. If setup still looks
              incomplete, Stripe has not saved the remaining payout steps on this account yet.
            </p>
          ) : null}

          {onboardingState === 'refresh_error' ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-300">
              Your Stripe setup link expired before it was opened. Start setup again to continue.
            </p>
          ) : null}
        </section>
      )}

      <section className={`grid gap-6 ${needsSetup ? 'xl:grid-cols-[minmax(0,1fr),320px]' : ''}`}>
        {needsSetup ? (
          <div className="brand-panel rounded-[28px] p-6 sm:p-7">
            <div className="max-w-2xl space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Secure Stripe setup
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Finish setup in Stripe, then come right back here
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  This opens Stripe&apos;s secure payout setup in the same tab. Start by connecting
                  your bank account. Stripe might also ask for the payout owner&apos;s name, address,
                  or other required payout details it is still missing. When you finish, Stripe
                  sends you back here and payout controls become available.
                </p>
                {onboardingState === 'return' && needsSetup ? (
                  <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">
                    If you still see setup tasks after coming back, open Stripe again and finish
                    the remaining bank-account or payout-term steps.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartSetup()}
                  disabled={isStartingSetup}
                  className="btn-primary px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStartingSetup ? 'Opening secure setup...' : startSetupLabel}
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Hosted securely by Stripe
                </span>
              </div>

              {setupError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
                  {setupError}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="brand-hero rounded-[32px] border border-gray-200/80 p-6 sm:p-7 dark:border-white/10">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px] xl:items-start">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-primary dark:border-white/10 dark:bg-white/5">
                    Live Stripe workspace
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                      Everything is connected
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                      Balances, payout history, bank details, and payout settings now live in one
                      secure Stripe workspace. New funds appear there automatically after Stripe
                      finishes settlement.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="brand-hero-card rounded-[24px] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] brand-hero-kicker">
                        Account status
                      </p>
                      <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Paid deal payouts are live
                      </p>
                    </div>

                    <div className="brand-hero-card rounded-[24px] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] brand-hero-kicker">
                        Bank account
                      </p>
                      <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {bankAccountSummary}
                      </p>
                    </div>

                    <div className="brand-hero-card rounded-[24px] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] brand-hero-kicker">
                        Payout schedule
                      </p>
                      <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {payoutScheduleSummary}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="brand-hero-card rounded-[28px] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] brand-hero-kicker">
                    Next steps
                  </p>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    <p>Review payout history, request payouts, or change payout settings below.</p>
                    <p>Pending funds will move into the available Stripe balance after settlement.</p>
                    <p>Use Refresh status anytime if you just updated Stripe in another tab.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="brand-panel rounded-[32px] border border-gray-200/80 p-4 sm:p-5 lg:p-6 dark:border-white/10">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Secure Stripe workspace
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Balances, payouts, and account settings
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Everything below is hosted securely by Stripe and synced back to Clientific.
                  </p>
                </div>

                <div className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary dark:bg-primary/15">
                  Live
                </div>
              </div>

              <EmbeddedPayoutWorkspace
                visible
                onboardingComplete={Boolean(connectData?.onboardingComplete)}
                onRefresh={refreshConnect}
              />
            </section>
          </div>
        )}

        {needsSetup ? (
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
                : 'Stripe has not saved a payout bank account yet'}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {connectData?.externalAccount?.accountHolderName ||
                'Finish secure setup until Stripe confirms the payout account details back to Clientific.'}
            </p>
          </div>

            <div className="brand-panel rounded-[24px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                What to expect
              </p>
              <div className="mt-3 space-y-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                <p>Stripe will start with the bank account and only the payout details it still requires.</p>
                <p>When Stripe finishes, you will come right back here and the live payout workspace will unlock automatically.</p>
              </div>
            </div>
          </aside>
        ) : null}
      </section>
    </div>
  );
}
