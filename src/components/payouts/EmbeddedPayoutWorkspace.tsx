'use client';

import { useEffect, useState } from 'react';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js/pure';
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectBalances,
  ConnectComponentsProvider,
  ConnectPayouts,
} from '@stripe/react-connect-js';
import { sanitizeStripeEnvValue } from '@/lib/stripe-env';

export type BalanceAmount = {
  amount: number;
  currency: string;
};

export type ConnectData = {
  notConnected: boolean;
  accountId: string | null;
  businessType: string | null;
  isReferralOnly: boolean;
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
  dealPayouts: {
    lifetimeEarned: number;
    pendingTransfer: number;
    transferredToConnect: number;
    pendingCount: number;
    transferredCount: number;
    automaticCount: number;
    lastTransferredAt: string | null;
  };
  referralPayouts: {
    lifetimeEarned: number;
    pendingTransfer: number;
    transferredToConnect: number;
    pendingCount: number;
    transferredCount: number;
    lastTransferredAt: string | null;
  };
};

type WorkspaceErrorState = {
  message: string;
  retryable: boolean;
};

function buildConnectAppearance(isDark: boolean) {
  return {
    overlays: 'dialog' as const,
    variables: {
      colorPrimary: '#0F8A63',
      colorBackground: isDark ? '#12202A' : '#FCFEFD',
      colorText: isDark ? '#F3F8F7' : '#102026',
      colorSecondaryText: isDark ? '#B8CAC5' : '#546A67',
      colorDanger: '#DC2626',
      colorBorder: isDark ? 'rgba(184, 202, 197, 0.18)' : '#D7E2E0',
      buttonPrimaryColorBackground: '#0F8A63',
      buttonPrimaryColorBorder: '#0F8A63',
      buttonPrimaryColorText: '#F8FFFC',
      buttonSecondaryColorBackground: isDark ? '#182A34' : '#F3F8F7',
      buttonSecondaryColorBorder: isDark ? '#31505B' : '#D7E2E0',
      buttonSecondaryColorText: isDark ? '#F3F8F7' : '#102026',
      badgeNeutralColorBackground: isDark ? '#1A2C36' : '#F3F8F7',
      badgeNeutralColorBorder: isDark ? '#31505B' : '#D7E2E0',
      badgeNeutralColorText: isDark ? '#D9E7E3' : '#385059',
      badgeSuccessColorBackground: isDark ? 'rgba(15, 138, 99, 0.18)' : 'rgba(15, 138, 99, 0.10)',
      badgeSuccessColorBorder: isDark ? 'rgba(103, 223, 178, 0.24)' : 'rgba(15, 138, 99, 0.18)',
      badgeSuccessColorText: isDark ? '#82E7BF' : '#0F8A63',
      badgeWarningColorBackground: isDark ? 'rgba(217, 119, 6, 0.18)' : 'rgba(217, 119, 6, 0.12)',
      badgeWarningColorBorder: isDark ? 'rgba(251, 191, 36, 0.24)' : 'rgba(217, 119, 6, 0.18)',
      badgeWarningColorText: isDark ? '#FCD34D' : '#B45309',
      badgeDangerColorBackground: isDark ? 'rgba(220, 38, 38, 0.18)' : 'rgba(220, 38, 38, 0.10)',
      badgeDangerColorBorder: isDark ? 'rgba(248, 113, 113, 0.24)' : 'rgba(220, 38, 38, 0.18)',
      badgeDangerColorText: isDark ? '#FCA5A5' : '#B91C1C',
      offsetBackgroundColor: isDark ? '#182A34' : '#F3F8F7',
      formBackgroundColor: isDark ? '#0D1820' : '#FFFFFF',
      formHighlightColorBorder: '#0F8A63',
      formAccentColor: '#0F8A63',
      actionPrimaryColorText: isDark ? '#82E7BF' : '#0F8A63',
      actionSecondaryColorText: isDark ? '#E7F2EF' : '#102026',
      borderRadius: '20px',
      buttonBorderRadius: '18px',
      formBorderRadius: '18px',
      overlayBorderRadius: '22px',
      spacingUnit: '12px',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      overlayBackdropColor: isDark ? 'rgba(3, 12, 18, 0.72)' : 'rgba(12, 24, 33, 0.18)',
    },
  };
}

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

export function collectOutstandingRequirementKeys(
  requirements: ConnectData['requirements'] | null | undefined
) {
  return [
    ...new Set([
      ...(requirements?.currentlyDue ?? []),
      ...(requirements?.pastDue ?? []),
      ...(requirements?.pendingVerification ?? []),
    ]),
  ].map((requirement) => requirement.toLowerCase());
}

export function summarizeRequirementTasks(requirements: string[]) {
  const tasks = new Map<string, string>();

  for (const requirement of requirements) {
    const normalized = requirement.toLowerCase();

    if (normalized.startsWith('external_account')) {
      tasks.set('bank_account', 'Connect a bank account for payouts');
      continue;
    }

    if (normalized.startsWith('business_profile.support_')) {
      tasks.set('support_contact', 'Add customer support contact details');
      continue;
    }

    if (
      normalized.startsWith('representative.') ||
      normalized.startsWith('owners.') ||
      normalized.startsWith('owner.') ||
      normalized.startsWith('person.') ||
      normalized.startsWith('individual.')
    ) {
      tasks.set('identity', 'Verify the payout owner identity');
      continue;
    }

    if (normalized.includes('tax') || normalized.includes('ein')) {
      tasks.set('tax', 'Provide business tax information');
      continue;
    }

    if (normalized.startsWith('documents.') || normalized.includes('document')) {
      tasks.set('documents', 'Upload verification documents');
      continue;
    }

    if (normalized.startsWith('tos_acceptance.')) {
      tasks.set('terms', 'Accept Stripe payout terms');
      continue;
    }

    if (normalized.startsWith('business_profile.') || normalized === 'business_type') {
      tasks.set('business_details', 'Complete payout profile details');
      continue;
    }

    tasks.set('fallback', 'Finish the remaining Stripe verification');
  }

  return Array.from(tasks.values());
}

export function summarizeRequirementGuidance(
  connectData:
    | Pick<ConnectData, 'externalAccount' | 'requirements'>
    | null
    | undefined
) {
  const requirements = collectOutstandingRequirementKeys(connectData?.requirements);
  const guidance = new Map<string, string>();

  if (!connectData?.externalAccount || requirements.some((item) => item.startsWith('external_account'))) {
    guidance.set('bank_account', 'Stripe still does not have a payout bank account saved for this account.');
  }

  if (requirements.some((item) => item.startsWith('tos_acceptance.'))) {
    guidance.set('terms', 'Stripe still needs the payout terms accepted before payouts can go live.');
  }

  if (
    requirements.some(
      (item) =>
        item.startsWith('representative.') ||
        item.startsWith('owners.') ||
        item.startsWith('owner.') ||
        item.startsWith('person.') ||
        item.startsWith('individual.')
    )
  ) {
    guidance.set('identity', 'Stripe still needs to verify the payout owner details on this account.');
  }

  if (requirements.some((item) => item.startsWith('business_profile.') || item === 'business_type')) {
    guidance.set('business_details', 'Stripe still needs a few payout profile details completed before payouts can be enabled.');
  }

  if (requirements.some((item) => item.startsWith('documents.') || item.includes('document'))) {
    guidance.set('documents', 'Stripe is still waiting on one or more verification documents for this payout account.');
  }

  return Array.from(guidance.values());
}

export function formatRequirementStatus(reason: string | null | undefined) {
  if (!reason) {
    return null;
  }

  if (reason === 'requirements.past_due') {
    return 'Stripe has paused payouts until the remaining setup items are completed.';
  }

  if (reason === 'requirements.pending_verification') {
    return 'Stripe is reviewing the submitted payout details before payouts can go live.';
  }

  if (reason.startsWith('requirements.')) {
    return 'Stripe still needs a few details before paid payouts can go live.';
  }

  return 'Stripe still has an additional payout review in progress.';
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
  const publishableKey = sanitizeStripeEnvValue(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [workspaceError, setWorkspaceError] = useState<WorkspaceErrorState | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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
          appearance: buildConnectAppearance(isDark),
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
  }, [isDark, publishableKey, refreshSeed, visible]);

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

  const workspaceSurfaceClass =
    'overflow-hidden rounded-[30px] border border-gray-200/80 bg-white/92 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[#0f1b23]/92';

  return (
    <div className="space-y-5">
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
            {!onboardingComplete ? (
              <div className={workspaceSurfaceClass}>
                <ConnectAccountOnboarding
                  collectionOptions={{ fields: 'currently_due' }}
                  onExit={onRefresh}
                />
              </div>
            ) : (
              <>
                <div className={workspaceSurfaceClass}>
                  <ConnectBalances />
                </div>
                <div className={workspaceSurfaceClass}>
                  <ConnectPayouts />
                </div>
                <div className={workspaceSurfaceClass}>
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
