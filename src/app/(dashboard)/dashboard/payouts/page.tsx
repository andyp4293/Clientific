'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  collectOutstandingRequirementKeys,
  type ConnectData,
  formatRequirementStatus,
  formatSchedule,
  summarizeRequirementTasks,
  summarizeRequirementGuidance,
  sumBalanceAmounts,
} from '@/components/payouts/EmbeddedPayoutWorkspace';

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
  } = useQuery<ConnectData>({
    queryKey: ['connect-payouts'],
    queryFn: async () => {
      const res = await fetch('/api/stripe/connect/payouts');
      if (!res.ok) throw new Error('Failed to load payout status');
      return res.json();
    },
  });

  const totals = earningsData?.totals;
  const transactions = earningsData?.transactions ?? [];
  const availableBalance = sumBalanceAmounts(connectData?.balances?.available);
  const pendingBalance = sumBalanceAmounts(connectData?.balances?.pending);
  const needsSetup = !connectData?.readyForPaidDeals;
  const referralLifetime = connectData?.referralPayouts?.lifetimeEarned ?? 0;
  const referralPending = connectData?.referralPayouts?.pendingTransfer ?? 0;
  const referralTransferred = connectData?.referralPayouts?.transferredToConnect ?? 0;
  const referralLastTransferredAt = connectData?.referralPayouts?.lastTransferredAt ?? null;
  const rawRequirementList = collectOutstandingRequirementKeys(connectData?.requirements);
  const requirementTasks = summarizeRequirementTasks(rawRequirementList);
  const requirementGuidance = summarizeRequirementGuidance(connectData);
  const requirementStatus = formatRequirementStatus(connectData?.requirements.disabledReason);

  return (
    <div className="max-w-7xl space-y-6 pb-28 md:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Clientific uses Stripe to securely handle business verification, subscription
            billing, and payouts to your connected bank account.
          </p>
        </div>
        <div className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          Secure payments and payouts
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Payout readiness
              </p>
              <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {connectLoading
                  ? 'Checking payout setup...'
                  : needsSetup
                    ? 'Finish setup before you sell paid deals'
                    : 'Paid deal payouts are live'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                {connectLoading
                  ? 'Loading your secure payout status.'
                  : needsSetup
                    ? 'Businesses only need this setup before publishing paid purchase-link deals. Free-service deals and code-claim offers can still run without payouts.'
                    : 'Customer payments route through Stripe Connect, your platform fee is collected automatically, and the rest can be paid out to your connected bank account on your chosen schedule.'}
              </p>
            </div>

            {!connectLoading && (
              <Link href="/dashboard/payouts/setup" className="btn-primary text-sm">
                {connectData?.notConnected ? 'Set up payouts' : 'Manage payout setup'}
              </Link>
            )}
          </div>

          {!connectLoading && connectData && (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Bank account
                </p>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {connectData.externalAccount
                    ? `${connectData.externalAccount.bankName ?? 'Bank account'} ending in ${connectData.externalAccount.last4}`
                    : 'Stripe has not saved a payout bank account yet'}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {connectData.externalAccount?.accountHolderName ||
                    'Keep going in secure setup until Stripe confirms the payout account back to Clientific.'}
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Payout schedule
                </p>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatSchedule(connectData.payoutSchedule)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Open the secure setup screen to switch between manual and automatic payouts.
                </p>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Paid deal status
                </p>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {connectData.readyForPaidDeals ? 'Ready to publish' : 'Setup still needed'}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {connectData.readyForPaidDeals
                    ? 'Purchase-link deals can be published and sold now.'
                    : 'Finish onboarding and bank setup before paid purchase links go live.'}
                </p>
              </div>
            </div>
          )}

          {!connectLoading && connectData && (requirementTasks.length > 0 || requirementStatus) && (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/20">
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
              {requirementGuidance.length > 0 ? (
                <div className="mt-3 space-y-2 text-xs text-amber-700 dark:text-amber-300">
                  {requirementGuidance.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                Open the secure setup screen and Stripe will guide you through the exact
                details that still need attention.
              </p>
              {requirementStatus ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {requirementStatus}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid gap-4">
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

          <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Next move
            </p>
            <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {needsSetup
                ? 'Finish secure payout setup, then publish paid deals.'
                : 'Use the payout controls below or create your next deal.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/dashboard/payouts/setup" className="btn-primary text-sm">
                {needsSetup ? 'Open setup' : 'Open payout controls'}
              </Link>
              <Link href="/dashboard/campaigns" className="btn-outline text-sm">
                Go to deals
              </Link>
            </div>
          </div>
        </div>
      </section>

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
