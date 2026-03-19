'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js/pure';
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectBalances,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayouts,
} from '@stripe/react-connect-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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

type BalanceAmount = {
  amount: number;
  currency: string;
};

type ConnectData = {
  notConnected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  readyForPaidDeals: boolean;
  bankAccountConnected: boolean;
  externalAccount: {
    id: string;
    bankName: string | null;
    last4: string;
    routingNumberLast4: string | null;
    accountHolderName: string | null;
    status: string | null;
  } | null;
  payoutSchedule: {
    interval: 'daily' | 'manual' | 'monthly' | 'weekly';
    monthlyPayoutDays: number[];
    weeklyPayoutDays: string[];
    statementDescriptor: string | null;
  } | null;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
    disabledReason: string | null;
  };
  balances: {
    available: BalanceAmount[];
    pending: BalanceAmount[];
  } | null;
  payouts: Array<{
    id: string;
    amount: number;
    currency: string;
    arrivalDate: number;
    status: string;
    bankLast4: string | null;
    bankName: string | null;
  }>;
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

function sumBalanceAmounts(amounts: BalanceAmount[] | undefined) {
  return (amounts ?? []).reduce((sum, amount) => sum + amount.amount, 0);
}

function formatSchedule(schedule: ConnectData['payoutSchedule']) {
  if (!schedule) {
    return 'Not configured yet';
  }

  if (schedule.interval === 'manual') {
    return 'Manual payouts whenever you request them';
  }

  if (schedule.interval === 'weekly') {
    const days = schedule.weeklyPayoutDays.length
      ? schedule.weeklyPayoutDays.map((day) => day[0].toUpperCase() + day.slice(1)).join(', ')
      : 'your selected payout day';
    return `Weekly payouts on ${days}`;
  }

  if (schedule.interval === 'monthly') {
    const days = schedule.monthlyPayoutDays.length
      ? schedule.monthlyPayoutDays.join(', ')
      : 'your selected payout date';
    return `Monthly payouts on day ${days}`;
  }

  return 'Daily automatic payouts';
}

function formatRequirementLabel(value: string) {
  return value
    .split(/[._]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function EmbeddedPayoutWorkspace({
  visible,
  onboardingComplete,
  onRefresh,
}: {
  visible: boolean;
  onboardingComplete: boolean;
  onRefresh: () => void;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    if (!visible) {
      setConnectInstance(null);
      setWorkspaceError(null);
      setIsInitializing(false);
      return;
    }

    if (!publishableKey) {
      setWorkspaceError('Stripe publishable key is missing.');
      setConnectInstance(null);
      setIsInitializing(false);
      return;
    }

    let cancelled = false;
    setWorkspaceError(null);
    setConnectInstance(null);
    setIsInitializing(true);

    const initializeWorkspace = async () => {
      try {
        const res = await fetch('/api/stripe/connect/account-session', {
          method: 'POST',
        });
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message = body.error || 'Failed to open secure Stripe setup.';
          throw new Error(message);
        }

        if (cancelled) {
          return;
        }

        const clientSecret = body.clientSecret as string;
        const instance = loadConnectAndInitialize({
          publishableKey,
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#7B22D4',
              colorBackground: '#FFFFFF',
              colorText: '#111827',
              colorDanger: '#DC2626',
              colorBorder: '#E5E7EB',
              borderRadius: '18px',
              spacingUnit: '12px',
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            },
          },
          fetchClientSecret: async () => clientSecret,
        });

        setWorkspaceError(null);
        setConnectInstance(instance);
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        setConnectInstance(null);
        setWorkspaceError(error?.message || 'Failed to open secure Stripe setup.');
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void initializeWorkspace();

    return () => {
      cancelled = true;
    };
  }, [publishableKey, refreshSeed, visible]);

  if (!visible) {
    return null;
  }

  if (!publishableKey) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
        Stripe publishable key is missing. Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` before using payouts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {workspaceError && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{workspaceError}</span>
            <button
              type="button"
              onClick={() => setRefreshSeed((value) => value + 1)}
              className="btn-outline text-xs"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {isInitializing ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Opening secure Stripe setup...
          </p>
        </div>
      ) : connectInstance ? (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <ConnectNotificationBanner
                collectionOptions={{ fields: 'currently_due', futureRequirements: 'include' }}
              />
            </div>

            {!onboardingComplete ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <ConnectAccountOnboarding
                  collectionOptions={{ fields: 'eventually_due', futureRequirements: 'include' }}
                  onExit={onRefresh}
                />
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <ConnectBalances />
                </div>
                <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <ConnectPayouts />
                </div>
                <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                  <ConnectAccountManagement
                    collectionOptions={{ fields: 'currently_due', futureRequirements: 'include' }}
                  />
                </div>
              </>
            )}
          </div>
        </ConnectComponentsProvider>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          Secure Stripe setup could not be opened yet. Try again to create a fresh setup session.
        </div>
      )}
    </div>
  );
}

export default function PayoutsPage() {
  const queryClient = useQueryClient();
  const [showWorkspace, setShowWorkspace] = useState(false);

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

  useEffect(() => {
    if (!connectData) {
      return;
    }

    if (!connectData.notConnected) {
      setShowWorkspace(true);
    }
  }, [connectData]);

  const totals = earningsData?.totals;
  const transactions = earningsData?.transactions ?? [];
  const availableBalance = sumBalanceAmounts(connectData?.balances?.available);
  const pendingBalance = sumBalanceAmounts(connectData?.balances?.pending);
  const needsSetup = !connectData?.readyForPaidDeals;
  const requirementList = [
    ...new Set([
      ...(connectData?.requirements.currentlyDue ?? []),
      ...(connectData?.requirements.pastDue ?? []),
      ...(connectData?.requirements.pendingVerification ?? []),
    ]),
  ];

  const refreshConnect = async () => {
    await refetchConnect();
    await queryClient.invalidateQueries({ queryKey: ['connect-payouts'] });
  };

  return (
    <div className="max-w-7xl space-y-6 pb-28 md:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Payouts powered by Stripe. Set up your bank once, then choose manual,
            weekly, or monthly payouts for paid deals.
          </p>
        </div>
        <div className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          Stripe-powered payouts
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
                  ? 'Loading your Stripe-powered payout status.'
                  : needsSetup
                    ? 'Businesses only need this setup before publishing paid purchase-link deals. Free-service deals and code-claim offers can still run without payouts.'
                    : 'Customer payments route through Stripe Connect, your platform fee is collected automatically, and the rest can be paid out to your connected bank account on your chosen schedule.'}
              </p>
            </div>

            {!connectLoading && (
              <button
                type="button"
                onClick={() => setShowWorkspace(true)}
                className="btn-primary text-sm"
              >
                {connectData?.notConnected ? 'Begin secure setup' : 'Manage payout setup'}
              </button>
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
                    ? `${connectData.externalAccount.bankName ?? 'Bank account'} •••• ${connectData.externalAccount.last4}`
                    : 'Not connected yet'}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {connectData.externalAccount?.accountHolderName ||
                    'Stripe collects and stores bank details securely.'}
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
                  You can switch between manual and automatic payouts in the Stripe controls below.
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

          {!connectLoading && connectData && requirementList.length > 0 && (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Stripe still needs a few items before paid deals can go live
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {requirementList.slice(0, 8).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    {formatRequirementLabel(item)}
                  </span>
                ))}
              </div>
              {connectData.requirements.disabledReason && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  Status from Stripe: {connectData.requirements.disabledReason}
                </p>
              )}
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
              <button
                type="button"
                onClick={() => setShowWorkspace(true)}
                className="btn-primary text-sm"
              >
                {needsSetup ? 'Open setup' : 'Open payout controls'}
              </button>
              <Link href="/dashboard/campaigns" className="btn-outline text-sm">
                Go to deals
              </Link>
            </div>
          </div>
        </div>
      </section>

      {showWorkspace && (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Secure setup
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Manage payout setup and payout preferences
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This embedded flow is powered by Stripe and handles bank setup, verification updates,
              payout schedule changes, and payout requests without sending the business to a separate dashboard.
            </p>
          </div>

          <EmbeddedPayoutWorkspace
            visible={showWorkspace}
            onboardingComplete={Boolean(connectData?.onboardingComplete)}
            onRefresh={refreshConnect}
          />
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
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
              {' · '}
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
                    {payout.bankLast4 ? ` •••• ${payout.bankLast4}` : ''}
                    {' · '}
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
