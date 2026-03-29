'use client';

import { useEffect, useState } from 'react';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { loadConnectAndInitialize } from '@stripe/connect-js/pure';
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
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
  businessName?: string | null;
  businessEmail?: string | null;
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

const MOBILE_CONNECT_OVERLAY_BREAKPOINT = 640;
const DESKTOP_CONNECT_OVERLAY_BREAKPOINT = 1280;

export function getConnectOverlayType(viewportWidth: number): 'dialog' | 'drawer' {
  return viewportWidth < MOBILE_CONNECT_OVERLAY_BREAKPOINT ||
    viewportWidth >= DESKTOP_CONNECT_OVERLAY_BREAKPOINT
    ? 'drawer'
    : 'dialog';
}

function buildConnectAppearance(isDark: boolean, overlayType: 'dialog' | 'drawer') {
  return {
    overlays: overlayType,
    variables: {
      colorPrimary: '#0F8A63',
      colorBackground: isDark ? '#111F26' : '#F3F8F7',
      colorText: isDark ? '#F3F8F7' : '#102026',
      colorSecondaryText: isDark ? '#B8CAC5' : '#546A67',
      colorDanger: '#DC2626',
      colorBorder: isDark ? 'rgba(184, 202, 197, 0.18)' : '#D7E2E0',
      buttonPrimaryColorBackground: '#0F8A63',
      buttonPrimaryColorBorder: '#0F8A63',
      buttonPrimaryColorText: '#F8FFFC',
      buttonSecondaryColorBackground: isDark ? '#111F26' : '#F3F8F7',
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
      offsetBackgroundColor: isDark ? '#111F26' : '#F3F8F7',
      formBackgroundColor: isDark ? '#111F26' : '#F3F8F7',
      formHighlightColorBorder: '#0F8A63',
      formAccentColor: '#0F8A63',
      actionPrimaryColorText: isDark ? '#82E7BF' : '#0F8A63',
      actionSecondaryColorText: isDark ? '#E7F2EF' : '#102026',
      borderRadius: '0px',
      buttonBorderRadius: '0px',
      formBorderRadius: '0px',
      overlayBorderRadius: '0px',
      spacingUnit: '12px',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      overlayBackdropColor: isDark ? 'rgba(3, 12, 18, 0.72)' : 'rgba(12, 24, 33, 0.18)',
    },
  };
}

function EmbeddedWorkspaceLoading({ onboardingComplete }: { onboardingComplete: boolean }) {
  return (
    <div
      data-testid="embedded-workspace-loading"
      className="space-y-4 border border-gray-200/80 bg-gray-50/70 p-5 dark:border-white/10 dark:bg-white/[0.04]"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {onboardingComplete
              ? 'Loading secure Stripe workspace...'
              : 'Loading secure Stripe setup...'}
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {onboardingComplete
              ? 'Stripe is preparing balances, payouts, and account settings for this session.'
              : 'Stripe is preparing a fresh secure verification session for this account.'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-12 animate-pulse bg-gray-200/80 dark:bg-white/10" />
        <div className="h-24 animate-pulse bg-gray-200/60 dark:bg-white/[0.08]" />
        <div className="h-24 animate-pulse bg-gray-200/60 dark:bg-white/[0.08]" />
      </div>
    </div>
  );
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

export function hasOnlyTermsAcceptanceOutstanding(
  requirements: ConnectData['requirements'] | null | undefined
) {
  const outstandingRequirements = collectOutstandingRequirementKeys(requirements);

  return (
    outstandingRequirements.length > 0 &&
    outstandingRequirements.every((requirement) => requirement.startsWith('tos_acceptance.'))
  );
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
  const onlyTermsAcceptanceOutstanding = hasOnlyTermsAcceptanceOutstanding(
    connectData?.requirements
  );

  if (!connectData?.externalAccount || requirements.some((item) => item.startsWith('external_account'))) {
    guidance.set('bank_account', 'Stripe still does not have a payout bank account saved for this account.');
  }

  if (requirements.some((item) => item.startsWith('tos_acceptance.'))) {
    guidance.set(
      'terms',
      onlyTermsAcceptanceOutstanding && connectData?.externalAccount
        ? 'Stripe already saved the payout bank account. The last step is accepting Stripe\'s Connected Account Agreement on the final review screen.'
        : 'Stripe still needs the payout terms accepted before payouts can go live.'
    );
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
  const [overlayType, setOverlayType] = useState<'dialog' | 'drawer'>(() =>
    typeof window === 'undefined' ? 'dialog' : getConnectOverlayType(window.innerWidth)
  );

  useEffect(() => {
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncOverlayType = () => setOverlayType(getConnectOverlayType(window.innerWidth));
    syncOverlayType();
    window.addEventListener('resize', syncOverlayType);
    return () => window.removeEventListener('resize', syncOverlayType);
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
          appearance: buildConnectAppearance(isDark, overlayType),
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
  }, [isDark, overlayType, publishableKey, refreshSeed, visible]);

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

  const workspaceSectionClass = 'overflow-hidden';
  const workspaceDividerClass = 'border-t border-gray-200/80 pt-5 dark:border-white/10';

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
        <EmbeddedWorkspaceLoading onboardingComplete={onboardingComplete} />
      ) : connectInstance ? (
        <ConnectComponentsProvider connectInstance={connectInstance}>
          <div className="space-y-4">
            {!onboardingComplete ? (
              <div className={workspaceSectionClass}>
                <ConnectAccountOnboarding
                  collectionOptions={{ fields: 'currently_due' }}
                  onExit={onRefresh}
                />
              </div>
            ) : (
              <>
                <div className={workspaceSectionClass}>
                  <ConnectPayouts />
                </div>
                <div className={workspaceDividerClass}>
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
