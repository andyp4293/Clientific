import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

type BusinessConnectSeed = {
  id: string;
  email: string;
  name: string;
  stripeConnectAccountId: string | null;
};

function isConnectOnboarded(account: Stripe.Account): boolean {
  return Boolean(account.charges_enabled && account.payouts_enabled && account.details_submitted);
}

export async function syncBusinessConnectAccount(
  businessId: string,
  account: Stripe.Account
) {
  return prisma.business.update({
    where: { id: businessId },
    data: {
      stripeConnectAccountId: account.id,
      stripeConnectChargesEnabled: account.charges_enabled,
      stripeConnectPayoutsEnabled: account.payouts_enabled,
      stripeConnectDetailsSubmitted: account.details_submitted,
      stripeConnectOnboardedAt: isConnectOnboarded(account) ? new Date() : null,
      stripeConnectLastSyncedAt: new Date(),
    },
  });
}

export async function ensureBusinessConnectAccount(
  business: BusinessConnectSeed,
  appUrl: string
) {
  if (business.stripeConnectAccountId) {
    try {
      const existing = await stripe.accounts.retrieve(business.stripeConnectAccountId);
      await syncBusinessConnectAccount(business.id, existing);
      return existing;
    } catch (err: any) {
      // In test mode, Connect accounts can be deleted. Clear the stale ID and create a new one.
      if (err?.code !== 'resource_missing') throw err;
      await prisma.business.update({
        where: { id: business.id },
        data: {
          stripeConnectAccountId: null,
          stripeConnectChargesEnabled: false,
          stripeConnectPayoutsEnabled: false,
          stripeConnectDetailsSubmitted: false,
          stripeConnectOnboardedAt: null,
        },
      });
    }
  }

  const created = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: business.email,
    business_type: 'company',
    metadata: {
      businessId: business.id,
    },
    business_profile: {
      name: business.name,
      url: appUrl,
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  await syncBusinessConnectAccount(business.id, created);
  return created;
}

export async function createConnectOnboardingLink(accountId: string, appUrl: string) {
  const refreshUrl = `${appUrl}/dashboard/campaigns?connect=refresh`;
  const returnUrl = `${appUrl}/dashboard/campaigns?connect=return`;

  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

export async function createConnectDashboardLink(accountId: string) {
  return stripe.accounts.createLoginLink(accountId);
}

export async function fetchConnectAccountOverview(accountId: string) {
  const [account, balance, payouts] = await Promise.all([
    stripe.accounts.retrieve(accountId),
    stripe.balance.retrieve({ stripeAccount: accountId }),
    stripe.payouts.list({ limit: 5 }, { stripeAccount: accountId }),
  ]);

  return {
    account,
    balance,
    payouts: payouts.data,
  };
}

export async function fetchConnectPayoutsOverview(accountId: string) {
  const [balance, payouts] = await Promise.all([
    stripe.balance.retrieve({}, { stripeAccount: accountId }),
    stripe.payouts.list(
      { limit: 20, expand: ['data.destination'] },
      { stripeAccount: accountId }
    ),
  ]);

  return {
    balance,
    payouts: payouts.data.map((payout) => {
      const destination = payout.destination as Stripe.BankAccount | null;
      return {
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        arrivalDate: payout.arrival_date,
        status: payout.status,
        bankLast4: destination?.last4 ?? null,
        bankName: destination?.bank_name ?? null,
      };
    }),
  };
}

export async function createConnectAccountSession(accountId: string) {
  return stripe.accountSessions.create({
    account: accountId,
    components: {
      account_onboarding: {
        enabled: true,
      },
      balances: {
        enabled: true,
      },
      payouts: {
        enabled: true,
      },
      notification_banner: {
        enabled: true,
      },
    },
  } as any);
}
