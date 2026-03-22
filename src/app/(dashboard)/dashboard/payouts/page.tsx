'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  collectOutstandingRequirementKeys,
  EmbeddedPayoutWorkspace,
  type ConnectData,
  formatRequirementStatus,
  formatSchedule,
  summarizeRequirementGuidance,
  summarizeRequirementTasks,
  sumBalanceAmounts,
} from '@/components/payouts/EmbeddedPayoutWorkspace';
import { FundsStatusPanel } from '@/components/payouts/FundsStatusPanel';

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
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '-';

const phone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1')
    ? `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    : digits.length === 10
      ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      : value;
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'redeemed':
      return 'bg-primary/10 text-primary';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

export default function PayoutsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isStartingSetup, setIsStartingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const { data: earningsData, isLoading: earningsLoading } = useQuery<EarningsData>({
    queryKey: ['deal-earnings'],
    queryFn: async () => {
      const res = await fetch('/api/deal-purchases/earnings');
      if (!res.ok) throw new Error('Failed to load earnings');
      return res.json();
    },
  });

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

  const totals = earningsData?.totals;
  const transactions = earningsData?.transactions ?? [];
  const availableBalance = sumBalanceAmounts(connectData?.balances?.available);
  const pendingBalance = sumBalanceAmounts(connectData?.balances?.pending);
  const dealPending = connectData?.dealPayouts?.pendingTransfer ?? 0;
  const dealPendingCount = connectData?.dealPayouts?.pendingCount ?? 0;
  const needsSetup = !connectData?.readyForPaidDeals;
  const referralLifetime = connectData?.referralPayouts?.lifetimeEarned ?? 0;
  const referralPending = connectData?.referralPayouts?.pendingTransfer ?? 0;
  const referralPendingCount = connectData?.referralPayouts?.pendingCount ?? 0;
  const referralTransferred = connectData?.referralPayouts?.transferredToConnect ?? 0;
  const referralLastTransferredAt = connectData?.referralPayouts?.lastTransferredAt ?? null;
  const rawRequirementList = collectOutstandingRequirementKeys(connectData?.requirements);
  const requirementTasks = summarizeRequirementTasks(rawRequirementList);
  const requirementGuidance = summarizeRequirementGuidance(connectData);
  const requirementStatus = formatRequirementStatus(connectData?.requirements.disabledReason);
  const bankAccountSummary = connectData?.externalAccount
    ? `${connectData.externalAccount.bankName ?? 'Bank account'} ending in ${connectData.externalAccount.last4}`
    : 'Stripe has not saved a payout bank account yet';
  const payoutScheduleSummary = formatSchedule(connectData?.payoutSchedule ?? null);
  const onboardingState = searchParams.get('stripe_onboarding');
  const startSetupLabel =
    onboardingState === 'return' ? 'Continue secure setup' : 'Start secure setup';

  const onboardingMessage =
    onboardingState === 'return' && needsSetup
      ? 'We rechecked Stripe when you came back. If setup still looks incomplete, Stripe has not saved the remaining payout steps on this account yet.'
      : onboardingState === 'refresh_error'
        ? 'Your Stripe setup link expired before it was opened. Start secure setup again to continue.'
        : onboardingState === 'missing_business'
          ? 'We could not find this business record while opening Stripe. Refresh the page and try again.'
          : onboardingState === 'return' && !needsSetup
            ? 'Stripe setup is complete. Your live payout controls are now ready below.'
            : null;

  return (
    <div data-testid="payouts-page" className="w-full space-y-6 pb-28 md:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Clientific uses Stripe to securely handle payout verification, subscription billing,
            and payouts to your connected bank account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!connectLoading ? (
            <button type="button" onClick={() => void refreshConnect()} className="btn-outline text-sm">
              Refresh status
            </button>
          ) : null}
          <div className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {needsSetup ? 'Secure payments and payouts' : 'Live Stripe workspace'}
          </div>
        </div>
      </div>

      {needsSetup ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
          <div className="space-y-6">
            <section className="brand-panel rounded-[32px] p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    Secure Stripe setup
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    Connect payouts without leaving this page
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Start with your bank account. Stripe will only ask for the payout-owner
                    details it still requires before paid deals and referrals can pay out.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleStartSetup()}
                  disabled={isStartingSetup}
                  className="btn-primary px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStartingSetup ? 'Opening secure setup...' : startSetupLabel}
                </button>
              </div>

              {onboardingMessage ? (
                <div
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                    onboardingState === 'refresh_error' || onboardingState === 'missing_business'
                      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300'
                      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-300'
                  }`}
                >
                  {onboardingMessage}
                </div>
              ) : null}

              {setupError ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
                  {setupError}
                </div>
              ) : null}

              {(requirementTasks.length > 0 || requirementStatus) && (
                <div className="mt-5 rounded-[28px] border border-gray-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {connectLoading
                          ? 'Checking setup requirements...'
                          : 'Complete these steps to enable payouts'}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Stripe shows only the payout steps that are still missing.
                      </p>
                    </div>
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
                    <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
                      {requirementStatus}
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    Payout readiness
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Finish setup before you publish paid deals
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Free-service deals and code-claim offers can still run without payouts. Paid
                    purchase-link deals start using Stripe payouts once setup is complete.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Bank account
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {bankAccountSummary}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {connectData?.externalAccount?.accountHolderName ||
                      'Stripe has not synced a payout account back to Clientific yet.'}
                  </p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Payout schedule
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {payoutScheduleSummary}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Stripe saves your preferred payout timing after setup is complete.
                  </p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Paid deal status
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Setup still needed
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Finish onboarding and bank setup before paid purchase links go live.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-4 xl:sticky xl:top-6">
            <FundsStatusPanel
              availableAmountCents={availableBalance}
              stripePendingAmountCents={pendingBalance}
              dealPendingAmountCents={dealPending}
              dealPendingCount={dealPendingCount}
              referralPendingAmountCents={referralPending}
              referralPendingCount={referralPendingCount}
              readyForPaidDeals={Boolean(connectData?.readyForPaidDeals)}
              isLoading={connectLoading}
              className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            />

            <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                What to expect
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                <p>Stripe starts with your bank account and only the payout details it still requires.</p>
                <p>When Stripe is done, this page becomes your live payout workspace automatically.</p>
                <p>You can come back here anytime to review balances, payout history, and settings.</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <section className="brand-hero rounded-[32px] border border-gray-200/80 p-6 sm:p-7 dark:border-white/10">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px] xl:items-start">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-primary dark:border-white/10 dark:bg-white/5">
                  Live Stripe workspace
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    Manage payouts right here
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                    Balances, payout history, bank details, and payout settings now live on this
                    page. New funds appear here automatically after Stripe finishes settlement.
                  </p>
                </div>

                {onboardingMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-200">
                    {onboardingMessage}
                  </div>
                ) : null}

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
                  <p>Review payout history, request payouts, or update payout settings below.</p>
                  <p>Pending funds move into the available Stripe balance after settlement clears.</p>
                  <p>Use Refresh status anytime if you just made changes inside Stripe.</p>
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
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Referral payouts
              </p>
              <h2 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                Recurring referral earnings move into your Stripe payout balance here
              </h2>
            </div>
            {referralLastTransferredAt ? (
              <p className="text-xs text-gray-400">
                Last moved {shortDate(referralLastTransferredAt)}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Lifetime earned
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {connectLoading ? '...' : cents(referralLifetime)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                All recorded referral subscription commissions
              </p>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Moved to Stripe
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {connectLoading ? '...' : cents(referralTransferred)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Already transferred into your Stripe payout balance
              </p>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Waiting to move
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {connectLoading ? '...' : cents(referralPending)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {needsSetup
                  ? 'Finish payout setup to move these earnings into Stripe'
                  : 'Clientific retries outstanding referral transfers automatically'}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {connectLoading
              ? 'Checking referral payout status...'
              : referralPending > 0
                ? needsSetup
                  ? `${cents(referralPending)} is waiting for you to finish Stripe payout setup before it can be paid out.`
                  : `${cents(referralPending)} is still waiting to move into your Stripe payout balance.`
                : referralLifetime > 0
                  ? 'All recorded referral earnings have already been moved into Stripe payouts.'
                  : 'Referral commissions will appear here after a referred business pays its subscription invoice.'}
          </p>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Total earned (net)
          </p>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {earningsLoading ? '...' : cents(totals?.totalNet ?? 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">After platform fees</p>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Gross sales
          </p>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {earningsLoading ? '...' : cents(totals?.totalGross ?? 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Total customer payments</p>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Platform fees
          </p>
          <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {earningsLoading ? '...' : cents(totals?.totalFees ?? 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">15% per paid deal purchase</p>
        </div>
      </div>

      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Earnings</p>
            <h2 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
              Transaction history
            </h2>
          </div>
          {totals && totals.transactionCount > 0 && (
            <p className="text-xs text-gray-400">
              {totals.transactionCount} sale{totals.transactionCount !== 1 ? 's' : ''}
              {' - '}
              {cents(totals.totalGross)} gross
            </p>
          )}
        </div>

        {earningsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No deal purchases yet. When customers buy your deals, their gross, fee, and net
            amounts will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Customer
                  </th>
                  <th className="hidden pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 sm:table-cell">
                    Deal
                  </th>
                  <th className="hidden pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 md:table-cell">
                    Date
                  </th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Gross
                  </th>
                  <th className="hidden pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 lg:table-cell">
                    Fee (15%)
                  </th>
                  <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Net
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {transaction.customerName}
                      </p>
                      <p className="text-xs text-gray-400">{phone(transaction.customerPhone)}</p>
                    </td>
                    <td className="hidden py-3 text-gray-600 dark:text-gray-400 sm:table-cell">
                      {transaction.dealTitle}
                    </td>
                    <td className="hidden py-3 text-gray-500 dark:text-gray-400 md:table-cell">
                      {shortDate(transaction.purchasedAt)}
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {cents(transaction.totalAmount)}
                    </td>
                    <td className="hidden py-3 text-right text-gray-500 dark:text-gray-400 lg:table-cell">
                      -{cents(transaction.applicationFeeAmount)}
                    </td>
                    <td className="py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {cents(transaction.businessNetAmount)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(transaction.status)}`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {connectData?.payouts?.length ? (
        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-6">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Stripe payouts
            </p>
            <h2 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
              Recent payouts
            </h2>
          </div>
          <div className="space-y-3">
            {connectData.payouts.map((payout) => (
              <div
                key={payout.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {cents(payout.amount)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {payout.bankName ?? 'Bank account'}
                    {payout.bankLast4 ? ` ending in ${payout.bankLast4}` : ''}
                    {' - '}
                    Expected {shortDate(new Date(payout.arrivalDate * 1000).toISOString())}
                  </p>
                </div>
                <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white dark:bg-gray-100 dark:text-gray-900">
                  {payout.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
