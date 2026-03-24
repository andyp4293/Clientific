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
  hasOnlyTermsAcceptanceOutstanding,
  summarizeRequirementGuidance,
  summarizeRequirementTasks,
  sumBalanceAmounts,
} from '@/components/payouts/EmbeddedPayoutWorkspace';
import { buildPayoutFundsBreakdown } from '@/lib/payout-funds';

type EarningsEntry = {
  id: string;
  kind: 'deal' | 'referral';
  sourceName: string;
  detailLabel: string | null;
  detailPhone: string | null;
  occurredAt: string | null;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: string;
};

type EarningsData = {
  entries: EarningsEntry[];
  totals: {
    dealGross: number;
    dealFees: number;
    dealNet: number;
    dealCount: number;
    referralNet: number;
    referralCount: number;
    totalNet: number;
    entryCount: number;
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
  switch (status.toLowerCase()) {
    case 'paid':
    case 'transferred':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'redeemed':
      return 'bg-primary/10 text-primary';
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

const formatStatusLabel = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'Paid';
    case 'redeemed':
      return 'Redeemed';
    case 'transferred':
      return 'Moved to Stripe';
    case 'pending':
      return 'Waiting to move';
    case 'failed':
      return 'Transfer failed';
    default:
      return status
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
};

const kindBadgeClass = (kind: EarningsEntry['kind']) =>
  kind === 'referral'
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-primary/10 text-primary';

const kindLabel = (kind: EarningsEntry['kind']) => (kind === 'referral' ? 'Referral' : 'Deal');

const earningsDetail = (entry: EarningsEntry) => {
  if (entry.detailLabel && entry.detailPhone) {
    return `${entry.detailLabel} - ${phone(entry.detailPhone)}`;
  }

  if (entry.detailLabel) {
    return entry.detailLabel;
  }

  if (entry.detailPhone) {
    return phone(entry.detailPhone);
  }

  return null;
};

export default function PayoutsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isStartingSetup, setIsStartingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const { data: earningsData, isLoading: earningsLoading } = useQuery<EarningsData>({
    queryKey: ['deal-earnings'],
    queryFn: async () => {
      const res = await fetch('/api/deal-purchases/earnings', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load earnings');
      return res.json();
    },
  });

  const {
    data: connectData,
    isLoading: connectLoading,
    error: connectError,
    refetch: refetchConnect,
  } = useQuery<ConnectData>({
    queryKey: ['connect-payouts'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/connect/payouts', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Failed to load payout status');
      }
      return body;
    },
  });

  const connectErrorMessage =
    connectError instanceof Error ? connectError.message : 'Failed to load payout status';
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

  const earningsTotals = earningsData?.totals;
  const earningsEntries = earningsData?.entries ?? [];
  const availableBalance = sumBalanceAmounts(connectData?.balances?.available);
  const pendingBalance = sumBalanceAmounts(connectData?.balances?.pending);
  const dealPending = connectData?.dealPayouts?.pendingTransfer ?? 0;
  const dealPendingCount = connectData?.dealPayouts?.pendingCount ?? 0;
  const hasConnectStatusError = Boolean(connectError);
  const needsSetup = !hasConnectStatusError && !connectData?.readyForPaidDeals;
  const isReferralOnly = Boolean(connectData?.isReferralOnly);
  const referralPending = connectData?.referralPayouts?.pendingTransfer ?? 0;
  const referralPendingCount = connectData?.referralPayouts?.pendingCount ?? 0;
  const rawRequirementList = collectOutstandingRequirementKeys(connectData?.requirements);
  const requirementTasks = summarizeRequirementTasks(rawRequirementList);
  const requirementGuidance = summarizeRequirementGuidance(connectData);
  const requirementStatus = formatRequirementStatus(connectData?.requirements.disabledReason);
  const onlyTermsAcceptanceOutstanding = hasOnlyTermsAcceptanceOutstanding(
    connectData?.requirements
  );
  const hasSavedBankButMissingTerms =
    needsSetup &&
    onlyTermsAcceptanceOutstanding &&
    Boolean(connectData?.externalAccount);
  const bankAccountSummary = connectData?.externalAccount
    ? `${connectData.externalAccount.bankName ?? 'Bank account'} ending in ${connectData.externalAccount.last4}`
    : 'Stripe has not saved a payout bank account yet';
  const payoutScheduleSummary = formatSchedule(connectData?.payoutSchedule ?? null);
  const onboardingState = searchParams.get('stripe_onboarding');
  const startSetupLabel =
    hasSavedBankButMissingTerms
      ? 'Resume final Stripe confirmation'
      : onboardingState === 'return'
        ? 'Continue secure setup'
        : 'Start secure setup';

  const onboardingMessage =
    onboardingState === 'return' && hasSavedBankButMissingTerms
      ? 'Stripe saved your bank account, but the final Stripe agreement was not submitted yet. On the Stripe review screen, scroll to the bottom and submit the final confirmation instead of using Return to Clientific in the sidebar.'
      : onboardingState === 'return' && needsSetup
        ? 'We rechecked Stripe when you came back. Stripe says there are still payout requirements open on this account, so you can continue the same secure setup from here.'
      : onboardingState === 'refresh_error'
        ? 'Your Stripe setup link expired before it was opened. Start secure setup again to continue.'
        : onboardingState === 'missing_business'
          ? 'We could not find this business record while opening Stripe. Refresh the page and try again.'
          : onboardingState === 'return' && !needsSetup
            ? 'Stripe setup is complete. Your live payout controls are now ready below.'
            : null;
  const fundsBreakdown = buildPayoutFundsBreakdown({
    availableAmountCents: availableBalance,
    stripePendingAmountCents: pendingBalance,
    dealPendingAmountCents: dealPending,
    dealPendingCount,
    referralPendingAmountCents: referralPending,
    referralPendingCount,
    readyForPaidDeals: Boolean(connectData?.readyForPaidDeals),
  });
  const liveSummaryDescription = isReferralOnly
    ? 'See your live payout balances while Stripe handles referral payouts and account settings.'
    : 'See your live payout balances while Stripe handles deals, referrals, and account settings.';
  const earningsSummaryDescription = isReferralOnly
    ? 'Track recorded referral commissions in one place.'
    : 'Track deal purchases and referral commissions in one place.';

  return (
    <div data-testid="payouts-page" className="w-full space-y-6 pb-28 md:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isReferralOnly
              ? 'Clientific uses Stripe to move referral earnings into your payout balance and send them to your connected bank account.'
              : 'Clientific uses Stripe to securely handle payout verification, deal payouts, subscription billing, and payouts to your connected bank account.'}
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

      {connectData?.businessName || connectData?.businessEmail ? (
        <div className="rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Current business:</span>{' '}
          {connectData?.businessName ?? 'Unknown business'}
          {connectData?.businessEmail ? (
            <>
              {' '}
              <span className="text-gray-500 dark:text-gray-400">
                ({connectData.businessEmail})
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      {hasConnectStatusError ? (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-5 shadow-sm dark:border-red-900/30 dark:bg-red-900/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-700 dark:text-red-300">
                Payout Status Unavailable
              </p>
              <h2 className="mt-2 text-xl font-semibold text-red-900 dark:text-red-100">
                Clientific could not verify the live Stripe payout status just now
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-red-800 dark:text-red-200">
                {connectErrorMessage}. This does not automatically mean your payout setup is incomplete.
                Refresh the status to try again.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void refreshConnect()}
              className="btn-outline border-red-300 text-sm text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/30"
            >
              Retry payout status
            </button>
          </div>
        </section>
      ) : null}

      {!hasConnectStatusError && needsSetup ? (
        <div className="space-y-6">
            <section className="brand-panel rounded-[32px] p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    Secure Stripe setup
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    {hasSavedBankButMissingTerms
                      ? 'Finish Stripe\'s final confirmation'
                      : 'Finish payout setup'}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    {hasSavedBankButMissingTerms
                      ? 'Stripe already saved your bank account. Return to Stripe and submit the final agreement to finish setup.'
                      : `Stripe will collect only the remaining payout details before ${isReferralOnly ? 'referral payouts' : 'paid deals and referrals'} can go live.`}
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
                    {isReferralOnly
                      ? 'Finish setup before referral payouts can go live'
                      : 'Finish setup before you publish paid deals'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    {isReferralOnly
                      ? 'Referral earnings move into Stripe after setup is complete.'
                      : 'Paid purchase-link deals start using Stripe payouts after setup is complete.'}
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
                    {isReferralOnly ? 'Referral payout status' : 'Paid deal status'}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Setup still needed
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {isReferralOnly
                      ? 'Finish onboarding and bank setup before referral earnings can pay out.'
                      : 'Finish onboarding and bank setup before paid purchase links go live.'}
                  </p>
                </div>
              </div>
            </section>
        </div>
      ) : !hasConnectStatusError ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr),minmax(340px,0.85fr)] xl:items-start">
            <div className="space-y-6">
              <section className="brand-panel rounded-[32px] border border-gray-200/80 p-4 sm:p-5 lg:p-6 dark:border-white/10">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      Secure Stripe workspace
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                      Manage payouts immediately
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                      Request payouts and manage account settings without leaving Clientific.
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

              <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 md:p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                      Earnings
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                      Earnings history
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                      {earningsSummaryDescription}
                    </p>
                  </div>

                  {earningsTotals?.entryCount ? (
                    <p className="text-xs text-gray-400">
                      {earningsTotals.entryCount} entr{earningsTotals.entryCount === 1 ? 'y' : 'ies'}
                      {' - '}
                      {earningsTotals.dealCount} deal{earningsTotals.dealCount === 1 ? '' : 's'}
                      {' - '}
                      {earningsTotals.referralCount} referral
                      {earningsTotals.referralCount === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>

                <div className="mt-6">
                  {earningsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((item) => (
                        <div
                          key={item}
                          className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                        />
                      ))}
                    </div>
                  ) : earningsEntries.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No earnings yet. Paid deal purchases and referral commissions will appear here.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800">
                            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                              Date
                            </th>
                            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                              Type
                            </th>
                            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                              Source
                            </th>
                            <th className="hidden pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 md:table-cell">
                              Detail
                            </th>
                            <th className="hidden pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 lg:table-cell">
                              Gross
                            </th>
                            <th className="hidden pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 lg:table-cell">
                              Fees
                            </th>
                            <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                              Earnings
                            </th>
                            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                          {earningsEntries.map((entry) => {
                            const detail = earningsDetail(entry);

                            return (
                              <tr key={`${entry.kind}-${entry.id}`}>
                                <td className="py-3 text-gray-500 dark:text-gray-400">
                                  {shortDate(entry.occurredAt)}
                                </td>
                                <td className="py-3">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${kindBadgeClass(entry.kind)}`}
                                  >
                                    {kindLabel(entry.kind)}
                                  </span>
                                </td>
                                <td className="py-3">
                                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                                    {entry.sourceName}
                                  </p>
                                  {detail ? (
                                    <p className="mt-1 text-xs text-gray-400 md:hidden">{detail}</p>
                                  ) : null}
                                </td>
                                <td className="hidden py-3 text-gray-500 dark:text-gray-400 md:table-cell">
                                  {detail ?? '-'}
                                </td>
                                <td className="hidden py-3 text-right font-medium text-gray-900 dark:text-gray-100 lg:table-cell">
                                  {cents(entry.grossAmount)}
                                </td>
                                <td className="hidden py-3 text-right text-gray-500 dark:text-gray-400 lg:table-cell">
                                  {entry.feeAmount > 0 ? `-${cents(entry.feeAmount)}` : '-'}
                                </td>
                                <td className="py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                                  {cents(entry.netAmount)}
                                </td>
                                <td className="py-3">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(entry.status)}`}
                                  >
                                    {formatStatusLabel(entry.status)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-6">
              <section className="brand-hero rounded-[32px] border border-gray-200/80 p-6 sm:p-7 dark:border-white/10">
                <p className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-primary dark:border-white/10 dark:bg-white/5">
                  Live payout summary
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Payout balances and schedule
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {liveSummaryDescription}
                </p>

                {onboardingMessage ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-200">
                    {onboardingMessage}
                  </div>
                ) : null}

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="brand-hero-card rounded-[24px] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] brand-hero-kicker">
                      Available now
                    </p>
                    <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {connectLoading ? '...' : cents(fundsBreakdown.availableAmountCents)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {connectLoading
                        ? 'Checking cleared payout funds...'
                        : fundsBreakdown.availableDescription}
                    </p>
                  </div>

                  <div className="brand-hero-card rounded-[24px] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] brand-hero-kicker">
                      Still pending
                    </p>
                    <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {connectLoading ? '...' : cents(fundsBreakdown.pendingAmountCents)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {connectLoading
                        ? 'Checking pending payout funds...'
                        : fundsBreakdown.pendingDescription}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="brand-hero-card rounded-[24px] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] brand-hero-kicker">
                      Bank account
                    </p>
                    <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {bankAccountSummary}
                    </p>
                    {connectData?.externalAccount?.accountHolderName ? (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                        {connectData.externalAccount.accountHolderName}
                      </p>
                    ) : null}
                  </div>

                  <div className="brand-hero-card rounded-[24px] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] brand-hero-kicker">
                      Payout schedule
                    </p>
                    <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {payoutScheduleSummary}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    Earnings
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                    Earnings overview
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Split current earnings between deal purchases and referrals.
                  </p>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Deal earnings
                    </p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {earningsLoading ? '...' : cents(earningsTotals?.dealNet ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {earningsLoading
                        ? 'Checking deal purchases...'
                        : 'Net deal revenue after platform fees'}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Referral earnings
                    </p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {earningsLoading ? '...' : cents(earningsTotals?.referralNet ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {earningsLoading
                        ? 'Checking referral commissions...'
                        : 'Recorded referral subscription commissions'}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      Total earnings
                    </p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {earningsLoading ? '...' : cents(earningsTotals?.totalNet ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {earningsLoading ? 'Checking combined earnings...' : 'Deals plus referrals'}
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </section>
        </>
      ) : null}

      {!hasConnectStatusError && connectData?.payouts?.length ? (
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
