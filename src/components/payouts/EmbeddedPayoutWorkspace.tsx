'use client';

import { useEffect, useState } from 'react';
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

export type BalanceAmount = {
  amount: number;
  currency: string;
};

export type ConnectData = {
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

type WorkspaceErrorState = {
  message: string;
  retryable: boolean;
};

export function sumBalanceAmounts(amounts: BalanceAmount[] | undefined) {
  return (amounts ?? []).reduce((sum, amount) => sum + amount.amount, 0);
}

export function formatSchedule(schedule: ConnectData['payoutSchedule']) {
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

export function formatRequirementLabel(value: string) {
  return value
    .split(/[._]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function EmbeddedPayoutWorkspace({
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
  const [workspaceError, setWorkspaceError] = useState<WorkspaceErrorState | null>(null);
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
      setWorkspaceError({
        message: 'Stripe publishable key is missing.',
        retryable: false,
      });
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
          throw Object.assign(new Error(message), {
            retryable: body.retryable !== false,
          });
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
              colorPrimary: '#059669',
              colorBackground: '#FFFFFF',
              colorText: '#111827',
              colorDanger: '#DC2626',
              colorBorder: '#E5E7EB',
              borderRadius: '18px',
              spacingUnit: '12px',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
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
        setWorkspaceError({
          message: error?.message || 'Failed to open secure Stripe setup.',
          retryable: error?.retryable !== false,
        });
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
        Stripe publishable key is missing. Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` before using
        payouts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {workspaceError && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{workspaceError.message}</span>
            {workspaceError.retryable ? (
              <button
                type="button"
                onClick={() => setRefreshSeed((value) => value + 1)}
                className="btn-outline text-xs"
              >
                Try again
              </button>
            ) : null}
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
          {workspaceError?.retryable === false
            ? 'Secure Stripe setup is temporarily unavailable while live payout access is being finalized.'
            : 'Secure Stripe setup could not be opened yet. Try again to create a fresh setup session.'}
        </div>
      )}
    </div>
  );
}
