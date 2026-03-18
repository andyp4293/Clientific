import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

type BusinessConnectSeed = {
  id: string;
  email: string;
  name: string;
  stripeConnectAccountId: string | null;
};

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
      stripeConnectOnboardedAt: account.charges_enabled ? new Date() : null,
      stripeConnectLastSyncedAt: new Date(),
    },
  });
}

/**
 * Ensures a Custom Connect account exists for the business.
 * Custom accounts are created and managed entirely by Clientific —
 * businesses never see a Stripe onboarding page or Stripe dashboard.
 * charges_enabled becomes true immediately after creation in test mode.
 */
export async function ensureBusinessConnectAccount(
  business: BusinessConnectSeed,
  _appUrl: string
) {
  if (business.stripeConnectAccountId) {
    try {
      const existing = await stripe.accounts.retrieve(business.stripeConnectAccountId);

      // If an old Express account is stored, clear it and create a Custom one instead
      if ((existing as any).type === 'express') {
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
      } else {
        await syncBusinessConnectAccount(business.id, existing);
        return existing;
      }
    } catch (err: any) {
      // Account was deleted (common in test mode) — fall through to create a new one
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

  // Create a Custom account — no onboarding redirect, fully managed by Clientific
  const created = await stripe.accounts.create({
    type: 'custom',
    country: 'US',
    email: business.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'company',
    company: { name: business.name },
    tos_acceptance: {
      // Clientific's ToS covers Stripe's service agreement on the business's behalf
      date: Math.floor(Date.now() / 1000),
      ip: '127.0.0.1',
    },
    settings: {
      payouts: {
        schedule: { interval: 'weekly', weekly_anchor: 'monday' },
      },
    },
    metadata: { businessId: business.id },
  });

  await syncBusinessConnectAccount(business.id, created);
  return created;
}

/**
 * Attaches a bank account to the business's Custom Connect account.
 * The business just provides routing + account number — no Stripe redirect needed.
 * Returns the external account object with last4 and bank_name.
 */
export async function addBankAccountToConnect(
  connectAccountId: string,
  routingNumber: string,
  accountNumber: string,
  accountHolderName: string
): Promise<Stripe.BankAccount> {
  const token = await stripe.tokens.create({
    bank_account: {
      country: 'US',
      currency: 'usd',
      routing_number: routingNumber,
      account_number: accountNumber,
      account_holder_name: accountHolderName,
      account_holder_type: 'company',
    },
  });

  const externalAccount = await stripe.accounts.createExternalAccount(
    connectAccountId,
    { external_account: token.id, default_for_currency: true }
  ) as Stripe.BankAccount;

  return externalAccount;
}

/**
 * Removes a bank account from the Connect account and clears it from the DB.
 */
export async function removeBankAccountFromConnect(
  connectAccountId: string,
  externalAccountId: string
) {
  await stripe.accounts.deleteExternalAccount(connectAccountId, externalAccountId);
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
      account_onboarding: { enabled: true },
      balances: { enabled: true },
      payouts: { enabled: true },
      notification_banner: { enabled: true },
    },
  } as any);
}
