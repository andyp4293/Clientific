import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import {
  emptyDealPayoutSummary,
  getDealPayoutSummary,
  settlePendingDealPurchasePayouts,
} from '@/lib/deal-payouts';
import {
  emptyReferralPayoutSummary,
  getReferralPayoutSummary,
  reconcileReferralCommissions,
  settlePendingReferralCommissions,
} from '@/lib/referral-payouts';
import {
  fetchConnectPayoutsOverview,
  isRecoverableConnectAccountError,
  syncBusinessConnectState,
} from '@/lib/stripe-connect';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';

function formatCurrencyFromCents(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

function sumBalanceAmounts(
  amounts: Array<{ amount: number }> | null | undefined,
) {
  return (amounts ?? []).reduce((sum, amount) => sum + amount.amount, 0);
}

function formatPayoutSchedule(schedule: {
  interval: 'daily' | 'manual' | 'monthly' | 'weekly';
  monthlyPayoutDays: number[];
  weeklyPayoutDays: string[];
} | null) {
  if (!schedule) {
    return 'Not configured yet';
  }

  if (schedule.interval === 'manual') {
    return 'Manual payouts';
  }

  if (schedule.interval === 'weekly') {
    return schedule.weeklyPayoutDays.length
      ? `Weekly on ${schedule.weeklyPayoutDays.join(', ')}`
      : 'Weekly payouts';
  }

  if (schedule.interval === 'monthly') {
    return schedule.monthlyPayoutDays.length
      ? `Monthly on day ${schedule.monthlyPayoutDays.join(', ')}`
      : 'Monthly payouts';
  }

  return 'Daily payouts';
}

function formatPayoutStatus(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateLabel(unixTimestamp: number) {
  return new Date(unixTimestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function summarizeRequirementTasks(requirements: {
  currentlyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
}) {
  const rawItems = [
    ...requirements.currentlyDue,
    ...requirements.pastDue,
    ...requirements.pendingVerification,
  ].map((item) => item.toLowerCase());
  const tasks = new Map<string, string>();

  for (const requirement of rawItems) {
    if (requirement.startsWith('external_account')) {
      tasks.set('bank', 'Add or confirm the payout bank account');
      continue;
    }

    if (requirement.startsWith('tos_acceptance.')) {
      tasks.set('terms', 'Accept the remaining Stripe payout terms');
      continue;
    }

    if (
      requirement.startsWith('representative.') ||
      requirement.startsWith('owners.') ||
      requirement.startsWith('owner.') ||
      requirement.startsWith('person.') ||
      requirement.startsWith('individual.')
    ) {
      tasks.set('identity', 'Finish the payout owner identity check');
      continue;
    }

    if (requirement.includes('tax') || requirement.includes('ein')) {
      tasks.set('tax', 'Provide the missing tax details');
      continue;
    }

    if (requirement.includes('document')) {
      tasks.set('documents', 'Upload the requested Stripe documents');
      continue;
    }

    tasks.set('profile', 'Finish the remaining Stripe payout details');
  }

  return Array.from(tasks.values());
}

function buildSetupMessage(connectState: {
  notConnected: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}) {
  if (connectState.notConnected) {
    return 'Connect Stripe payouts before funds can move.';
  }

  if (!connectState.detailsSubmitted) {
    return 'Stripe still needs the core payout profile finished.';
  }

  if (!connectState.chargesEnabled) {
    return 'Stripe is still reviewing money movement for this account.';
  }

  if (!connectState.payoutsEnabled) {
    return 'Add a bank account and clear the remaining payout requirements.';
  }

  return null;
}

function emptyFundsResponse(
  business: {
    id: string;
    email: string;
    name: string;
    businessType: string;
    phone: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
  },
  referralPayouts = emptyReferralPayoutSummary(),
  dealPayouts = emptyDealPayoutSummary(),
) {
  return {
    business: {
      id: business.id,
      email: business.email,
      name: business.name,
      businessType: business.businessType,
      onboardingComplete: isBusinessOnboardingComplete(business),
    },
    notConnected: true,
    payoutReady: false,
    onboardingComplete: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    availableBalanceLabel: '$0.00',
    pendingBalanceLabel: '$0.00',
    dealPendingTransferLabel: formatCurrencyFromCents(dealPayouts.pendingTransfer),
    referralPendingTransferLabel: formatCurrencyFromCents(referralPayouts.pendingTransfer),
    dealTransferredLabel: formatCurrencyFromCents(dealPayouts.transferredToConnect),
    referralTransferredLabel: formatCurrencyFromCents(referralPayouts.transferredToConnect),
    bankAccountSummary: null,
    payoutScheduleSummary: 'Not configured yet',
    setupMessage: 'Connect Stripe payouts before funds can move.',
    requirementTasks: ['Finish the Stripe payout setup'],
    recentPayouts: [],
  };
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.accountType === 'staff') {
      return NextResponse.json(
        { error: 'Employee accounts can only access assigned appointments.' },
        { status: 403 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        name: true,
        email: true,
        businessType: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        stripeConnectAccountId: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await reconcileReferralCommissions({
        businessId: business.id,
        lookbackDays: 90,
      });
    } catch (error) {
      console.error('GET /api/mobile/funds referral reconciliation error:', error);
    }

    const [referralPayouts, dealPayouts] = await Promise.all([
      getReferralPayoutSummary(business.id),
      getDealPayoutSummary(business.id),
    ]);

    if (!business.stripeConnectAccountId) {
      return NextResponse.json(emptyFundsResponse(business, referralPayouts, dealPayouts));
    }

    try {
      const status = await syncBusinessConnectState(business.id, business.stripeConnectAccountId);
      if (status.onboardingComplete) {
        await settlePendingDealPurchasePayouts({
          businessId: business.id,
          connectAccountId: status.accountId,
        });
        await settlePendingReferralCommissions({
          businessId: business.id,
          connectAccountId: status.accountId,
        });
      }

      const [updatedReferralPayouts, updatedDealPayouts] = await Promise.all([
        getReferralPayoutSummary(business.id),
        getDealPayoutSummary(business.id),
      ]);
      const overview = status.onboardingComplete
        ? await fetchConnectPayoutsOverview(status.accountId)
        : null;
      const availableBalance = sumBalanceAmounts(overview?.balance.available);
      const pendingBalance = sumBalanceAmounts(overview?.balance.pending);

      return NextResponse.json({
        business: {
          id: business.id,
          email: business.email,
          name: business.name,
          businessType: business.businessType,
          onboardingComplete: isBusinessOnboardingComplete(business),
        },
        notConnected: false,
        payoutReady: status.onboardingComplete,
        onboardingComplete: status.onboardingComplete,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        availableBalanceLabel: formatCurrencyFromCents(availableBalance),
        pendingBalanceLabel: formatCurrencyFromCents(pendingBalance),
        dealPendingTransferLabel: formatCurrencyFromCents(updatedDealPayouts.pendingTransfer),
        referralPendingTransferLabel: formatCurrencyFromCents(updatedReferralPayouts.pendingTransfer),
        dealTransferredLabel: formatCurrencyFromCents(updatedDealPayouts.transferredToConnect),
        referralTransferredLabel: formatCurrencyFromCents(updatedReferralPayouts.transferredToConnect),
        bankAccountSummary: status.externalAccount
          ? `${status.externalAccount.bankName ?? 'Bank account'} ending in ${status.externalAccount.last4}`
          : null,
        payoutScheduleSummary: formatPayoutSchedule({
          interval: status.payoutSchedule.interval,
          monthlyPayoutDays: status.payoutSchedule.monthlyPayoutDays,
          weeklyPayoutDays: status.payoutSchedule.weeklyPayoutDays,
        }),
        setupMessage: buildSetupMessage({
          notConnected: false,
          detailsSubmitted: status.detailsSubmitted,
          chargesEnabled: status.chargesEnabled,
          payoutsEnabled: status.payoutsEnabled,
        }),
        requirementTasks: summarizeRequirementTasks(status.requirements),
        recentPayouts: (overview?.payouts ?? []).map((payout) => ({
          id: payout.id,
          amountLabel: formatCurrencyFromCents(payout.amount),
          arrivalDateLabel: formatDateLabel(payout.arrivalDate),
          destinationLabel: payout.bankLast4
            ? `${payout.bankName ?? 'Bank'} ••••${payout.bankLast4}`
            : payout.bankName ?? 'Stripe payout',
          statusLabel: formatPayoutStatus(payout.status),
        })),
      });
    } catch (error) {
      if (isRecoverableConnectAccountError(error)) {
        return NextResponse.json({
          ...emptyFundsResponse(business, referralPayouts, dealPayouts),
          connectStatusUnavailable: true,
          setupMessage:
            'Clientific could not verify Stripe payouts right now. Your saved payout setup was left unchanged.',
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('GET /api/mobile/funds error:', error);
    return NextResponse.json({ error: 'Unable to load mobile funds' }, { status: 500 });
  }
}
