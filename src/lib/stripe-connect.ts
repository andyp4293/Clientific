import type Stripe from 'stripe';
import { APP_NAME } from '@/lib/brand';
import { prisma } from '@/lib/prisma';
import { STRIPE_API_VERSION, stripe } from '@/lib/stripe';
import { formatPhoneNumber, isValidPhoneNumber } from '@/lib/twilio';

type BusinessConnectSeed = {
  id: string;
  email: string;
  name: string;
  ownerPhone?: string | null;
  phone?: string | null;
  businessEmail?: string | null;
  publicId?: string | null;
  slug?: string | null;
  stripeConnectAccountId: string | null;
};

const RECOVERABLE_CONNECT_ACCOUNT_ERROR_CODES = new Set([
  'resource_missing',
  'account_invalid',
]);
const MIN_BALANCE_SETTINGS_PAYOUT_DESCRIPTOR_API_DATE = '2025-08-27';

export type ConnectExternalBankAccountSummary = {
  id: string;
  bankName: string | null;
  last4: string;
  routingNumberLast4: string | null;
  accountHolderName: string | null;
  status: string | null;
};

export type ConnectPayoutScheduleSummary = {
  interval: 'daily' | 'manual' | 'monthly' | 'weekly';
  monthlyPayoutDays: number[];
  weeklyPayoutDays: Stripe.BalanceSettings.Payments.Payouts.Schedule.WeeklyPayoutDay[];
  statementDescriptor: string | null;
};

export type ConnectRequirementsSummary = {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
};

export type ConnectAccountStatusSummary = {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  bankAccountConnected: boolean;
  externalAccount: ConnectExternalBankAccountSummary | null;
  payoutSchedule: ConnectPayoutScheduleSummary;
  requirements: ConnectRequirementsSummary;
};

function hasActiveConnectMoneyMovement(
  account: Pick<Stripe.Account, 'charges_enabled' | 'capabilities'>
) {
  return Boolean(account.charges_enabled || account.capabilities?.transfers === 'active');
}

export function isConnectAccountReady(
  account: Pick<
    Stripe.Account,
    'charges_enabled' | 'payouts_enabled' | 'details_submitted' | 'capabilities'
  >
) {
  return Boolean(
    hasActiveConnectMoneyMovement(account) &&
      account.payouts_enabled &&
      account.details_submitted
  );
}

function buildStatementDescriptor() {
  const sanitized = APP_NAME
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const truncated = sanitized.slice(0, 22).trim();
  return truncated.length >= 5 ? truncated : APP_NAME.toUpperCase();
}

function canUpdateAccountStatementDescriptor(account: Stripe.Account) {
  return !(
    account.details_submitted ||
    account.payouts_enabled ||
    hasActiveConnectMoneyMovement(account)
  );
}

function supportsBalanceSettingsPayoutDescriptorSync(apiVersion: string) {
  const versionDate = apiVersion.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];

  if (!versionDate) {
    return false;
  }

  if (versionDate > MIN_BALANCE_SETTINGS_PAYOUT_DESCRIPTOR_API_DATE) {
    return true;
  }

  if (versionDate < MIN_BALANCE_SETTINGS_PAYOUT_DESCRIPTOR_API_DATE) {
    return false;
  }

  return apiVersion.includes('.preview');
}

async function syncConnectStatementDescriptor(
  account: Stripe.Account,
  payoutSchedule: ConnectPayoutScheduleSummary
) {
  const expectedStatementDescriptor = buildStatementDescriptor();
  const currentStatementDescriptor = payoutSchedule.statementDescriptor?.trim() ?? null;
  const currentAccountStatementDescriptor =
    account.settings?.payouts?.statement_descriptor?.trim() ?? null;
  const shouldUpdateAccountStatementDescriptor =
    currentAccountStatementDescriptor !== expectedStatementDescriptor &&
    canUpdateAccountStatementDescriptor(account);
  const shouldUpdatePayoutStatementDescriptor =
    currentStatementDescriptor !== expectedStatementDescriptor &&
    supportsBalanceSettingsPayoutDescriptorSync(STRIPE_API_VERSION);

  if (!shouldUpdateAccountStatementDescriptor && !shouldUpdatePayoutStatementDescriptor) {
    return {
      account,
      payoutSchedule,
    };
  }

  const [updatedAccountResult, updatedBalanceSettingsResult] = await Promise.allSettled([
    !shouldUpdateAccountStatementDescriptor
      ? Promise.resolve(account)
      : stripe.accounts.update(account.id, {
          settings: {
            payouts: {
              statement_descriptor: expectedStatementDescriptor,
            },
          },
        }),
    !shouldUpdatePayoutStatementDescriptor
      ? Promise.resolve<Stripe.BalanceSettings | null>(null)
      : stripe.balanceSettings.update(
          {
            payments: {
              payouts: {
                statement_descriptor: expectedStatementDescriptor,
              },
            },
          },
          {
            stripeAccount: account.id,
          }
        ),
  ]);

  if (updatedAccountResult.status === 'rejected') {
    console.error('Failed to sync Stripe account statement descriptor:', updatedAccountResult.reason);
  }

  if (updatedBalanceSettingsResult.status === 'rejected') {
    console.error(
      'Failed to sync Stripe payout statement descriptor:',
      updatedBalanceSettingsResult.reason
    );
  }

  return {
    account:
      updatedAccountResult.status === 'fulfilled'
        ? updatedAccountResult.value
        : account,
    payoutSchedule:
      updatedBalanceSettingsResult.status === 'fulfilled' &&
      updatedBalanceSettingsResult.value
        ? normalizePayoutSchedule(updatedBalanceSettingsResult.value)
        : payoutSchedule,
  };
}

function isLegacyApplicationManagedAccount(account: Stripe.Account) {
  return Boolean(
    account.type === 'custom' ||
    account.controller?.losses?.payments === 'application' ||
    account.controller?.requirement_collection === 'application'
  );
}

function shouldRecreateLegacyEmbeddedAccount(account: Stripe.Account) {
  return Boolean(
    isLegacyApplicationManagedAccount(account) &&
    !account.details_submitted &&
    !account.charges_enabled &&
    !account.payouts_enabled
  );
}

function shouldRecreateIncompleteUnsupportedRecipientAccount(account: Stripe.Account) {
  const serviceAgreement = account.tos_acceptance?.service_agreement?.toLowerCase();

  return Boolean(
    !isConnectAccountReady(account) &&
      serviceAgreement === 'recipient'
  );
}

function shouldRecreateIncompleteNonIndividualAccount(account: Stripe.Account) {
  return Boolean(
    !account.details_submitted &&
      !account.charges_enabled &&
      !account.payouts_enabled &&
      account.business_type !== 'individual'
  );
}

function canDisableStripeUserAuthentication(
  account:
    | Pick<Stripe.Account, 'type' | 'controller'>
    | null
    | undefined
) {
  return Boolean(
    account?.type === 'custom' ||
    account?.controller?.requirement_collection === 'application'
  );
}

function canRefreshIncompleteConnectAccount(
  account: Pick<Stripe.Account, 'type' | 'controller'>
) {
  return Boolean(
    account.type === 'custom' ||
    account.controller?.requirement_collection === 'application'
  );
}

function buildConnectBusinessProfile(
  business: BusinessConnectSeed,
  appUrl: string
): Stripe.AccountCreateParams.BusinessProfile {
  const supportEmail = business.businessEmail?.trim() || business.email;
  const supportPhone =
    (business.phone && isValidPhoneNumber(business.phone)
      ? formatPhoneNumber(business.phone)
      : business.ownerPhone && isValidPhoneNumber(business.ownerPhone)
        ? formatPhoneNumber(business.ownerPhone)
        : undefined);
  const publicUrl = business.publicId
    ? `${appUrl}/business/${business.publicId}`
    : business.slug
      ? `${appUrl}/book/${business.slug}`
      : appUrl;

  return {
    name: business.name,
    product_description: `${business.name} uses ${APP_NAME} for bookings, payments, and customer follow-up.`,
    support_email: supportEmail,
    ...(supportPhone ? { support_phone: supportPhone } : {}),
    url: publicUrl,
  };
}

function buildConnectAccountRefreshParams(
  business: BusinessConnectSeed,
  appUrl: string
): Stripe.AccountUpdateParams {
  return {
    business_profile: buildConnectBusinessProfile(business, appUrl),
    settings: {
      payouts: {
        statement_descriptor: buildStatementDescriptor(),
      },
    },
  };
}

export function isRecoverableConnectAccountError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';

  return RECOVERABLE_CONNECT_ACCOUNT_ERROR_CODES.has(code);
}

async function resetBusinessConnectState(businessId: string) {
  await Promise.all([
    prisma.business.update({
      where: { id: businessId },
      data: {
        stripeConnectAccountId: null,
        stripeConnectChargesEnabled: false,
        stripeConnectPayoutsEnabled: false,
        stripeConnectDetailsSubmitted: false,
        stripeConnectOnboardedAt: null,
        stripeConnectLastSyncedAt: new Date(),
      },
    }),
    prisma.businessBankAccount.deleteMany({
      where: { businessId },
    }),
  ]);
}

function normalizeExternalBankAccount(
  account: Stripe.Account
): ConnectExternalBankAccountSummary | null {
  const externalAccounts = account.external_accounts;
  if (!externalAccounts || typeof externalAccounts === 'string') {
    return null;
  }

  const bankAccounts = externalAccounts.data.filter(
    (externalAccount): externalAccount is Stripe.BankAccount =>
      externalAccount.object === 'bank_account'
  );
  const selectedBank =
    bankAccounts.find((externalAccount) => externalAccount.default_for_currency) ??
    bankAccounts[0] ??
    null;

  if (!selectedBank) {
    return null;
  }

  return {
    id: selectedBank.id,
    bankName: selectedBank.bank_name ?? null,
    last4: selectedBank.last4,
    routingNumberLast4: selectedBank.routing_number?.slice(-4) ?? null,
    accountHolderName: selectedBank.account_holder_name ?? null,
    status: selectedBank.status ?? null,
  };
}

function normalizePayoutSchedule(
  balanceSettings: Stripe.BalanceSettings
): ConnectPayoutScheduleSummary {
  const payouts = balanceSettings.payments?.payouts;
  const schedule = payouts?.schedule;

  return {
    interval: schedule?.interval ?? 'manual',
    monthlyPayoutDays: schedule?.monthly_payout_days ?? [],
    weeklyPayoutDays: schedule?.weekly_payout_days ?? [],
    statementDescriptor: payouts?.statement_descriptor ?? null,
  };
}

function normalizeRequirements(
  account: Stripe.Account
): ConnectRequirementsSummary {
  return {
    currentlyDue: account.requirements?.currently_due ?? [],
    eventuallyDue: account.requirements?.eventually_due ?? [],
    pastDue: account.requirements?.past_due ?? [],
    pendingVerification: account.requirements?.pending_verification ?? [],
    disabledReason: account.requirements?.disabled_reason ?? null,
  };
}

async function syncBusinessBankAccount(
  businessId: string,
  externalAccount: ConnectExternalBankAccountSummary | null
) {
  if (!externalAccount) {
    await prisma.businessBankAccount.deleteMany({
      where: { businessId },
    });
    return;
  }

  await prisma.businessBankAccount.upsert({
    where: { businessId },
    create: {
      businessId,
      stripeExternalAccountId: externalAccount.id,
      bankName: externalAccount.bankName,
      last4: externalAccount.last4,
      routingNumberLast4: externalAccount.routingNumberLast4 ?? 'unknown',
      accountHolderName: externalAccount.accountHolderName,
    },
    update: {
      stripeExternalAccountId: externalAccount.id,
      bankName: externalAccount.bankName,
      last4: externalAccount.last4,
      routingNumberLast4: externalAccount.routingNumberLast4 ?? 'unknown',
      accountHolderName: externalAccount.accountHolderName,
    },
  });
}

export async function syncBusinessConnectAccount(
  businessId: string,
  account: Stripe.Account
) {
  const moneyMovementEnabled = hasActiveConnectMoneyMovement(account);

  return prisma.business.update({
    where: { id: businessId },
    data: {
      stripeConnectAccountId: account.id,
      stripeConnectChargesEnabled: moneyMovementEnabled,
      stripeConnectPayoutsEnabled: account.payouts_enabled,
      stripeConnectDetailsSubmitted: account.details_submitted,
      stripeConnectOnboardedAt: isConnectAccountReady(account) ? new Date() : null,
      stripeConnectLastSyncedAt: new Date(),
    },
  });
}

export async function fetchConnectAccountStatus(
  accountId: string
): Promise<ConnectAccountStatusSummary> {
  const [account, balanceSettings] = await Promise.all([
    stripe.accounts.retrieve(accountId, { expand: ['external_accounts'] }),
    stripe.balanceSettings.retrieve({}, { stripeAccount: accountId }),
  ]);

  const externalAccount = normalizeExternalBankAccount(account);

  return {
    accountId: account.id,
    chargesEnabled: hasActiveConnectMoneyMovement(account),
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    onboardingComplete: isConnectAccountReady(account),
    bankAccountConnected: Boolean(externalAccount),
    externalAccount,
    payoutSchedule: normalizePayoutSchedule(balanceSettings),
    requirements: normalizeRequirements(account),
  };
}

export async function syncBusinessConnectState(
  businessId: string,
  accountId: string
): Promise<ConnectAccountStatusSummary> {
  const [account, status] = await Promise.all([
    stripe.accounts.retrieve(accountId),
    fetchConnectAccountStatus(accountId),
  ]);
  const { account: syncedAccount, payoutSchedule } = await syncConnectStatementDescriptor(
    account,
    status.payoutSchedule
  );
  const syncedStatus =
    payoutSchedule === status.payoutSchedule
      ? status
      : {
          ...status,
          payoutSchedule,
        };

  await Promise.all([
    syncBusinessConnectAccount(businessId, syncedAccount),
    syncBusinessBankAccount(businessId, syncedStatus.externalAccount),
  ]);

  return syncedStatus;
}

/**
 * Ensures a lighter Stripe-managed Connect account exists for the payout recipient.
 * We default new and unfinished recipients to Stripe's individual profile so the
 * hosted onboarding flow asks for owner details instead of company-style details
 * whenever Stripe allows it, while still collecting only currently due requirements.
 */
export async function ensureBusinessConnectAccount(
  business: BusinessConnectSeed,
  appUrl: string
) {
  if (business.stripeConnectAccountId) {
    try {
      const existing = await stripe.accounts.retrieve(business.stripeConnectAccountId);

      if ((existing as Stripe.Account).type === 'express') {
        await resetBusinessConnectState(business.id);
      } else if (shouldRecreateLegacyEmbeddedAccount(existing)) {
        await resetBusinessConnectState(business.id);
      } else if (shouldRecreateIncompleteUnsupportedRecipientAccount(existing)) {
        await resetBusinessConnectState(business.id);
      } else if (shouldRecreateIncompleteNonIndividualAccount(existing)) {
        await resetBusinessConnectState(business.id);
      } else {
        if (!isConnectAccountReady(existing) && canRefreshIncompleteConnectAccount(existing)) {
          const refreshed = await stripe.accounts.update(
            existing.id,
            buildConnectAccountRefreshParams(business, appUrl)
          );
          await syncBusinessConnectAccount(business.id, refreshed);
          return refreshed;
        }

        await syncBusinessConnectAccount(business.id, existing);
        return existing;
      }
    } catch (error: any) {
      if (!isRecoverableConnectAccountError(error)) {
        throw error;
      }

      await resetBusinessConnectState(business.id);
    }
  }

  const created = await stripe.accounts.create({
    country: 'US',
    email: business.email,
    business_type: 'individual',
    business_profile: buildConnectBusinessProfile(business, appUrl),
    controller: {
      stripe_dashboard: {
        type: 'none',
      },
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payouts: {
        statement_descriptor: buildStatementDescriptor(),
        schedule: {
          interval: 'manual',
        },
      },
    },
    metadata: {
      businessId: business.id,
      businessName: business.name,
      payoutSetupMode: 'individual_currently_due_only',
    },
  });

  await syncBusinessConnectAccount(business.id, created);
  return created;
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

export async function createConnectAccountSession(
  account: Pick<Stripe.Account, 'id' | 'type' | 'controller'>
) {
  const disableStripeUserAuthentication = canDisableStripeUserAuthentication(account);

  return stripe.accountSessions.create({
    account: account.id,
    components: {
      account_onboarding: {
        enabled: true,
        features: {
          disable_stripe_user_authentication: disableStripeUserAuthentication,
          external_account_collection: true,
        },
      },
      account_management: {
        enabled: true,
        features: {
          disable_stripe_user_authentication: disableStripeUserAuthentication,
          external_account_collection: true,
        },
      },
      notification_banner: {
        enabled: true,
        features: {
          disable_stripe_user_authentication: disableStripeUserAuthentication,
          external_account_collection: true,
        },
      },
      balances: {
        enabled: true,
        features: {
          disable_stripe_user_authentication: disableStripeUserAuthentication,
          edit_payout_schedule: true,
          external_account_collection: true,
          standard_payouts: true,
        },
      },
      payouts: {
        enabled: true,
        features: {
          disable_stripe_user_authentication: disableStripeUserAuthentication,
          edit_payout_schedule: true,
          external_account_collection: true,
          standard_payouts: true,
        },
      },
      payouts_list: {
        enabled: true,
      },
    },
  });
}

export async function createConnectOnboardingLink({
  accountId,
  refreshUrl,
  returnUrl,
}: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
    collection_options: {
      fields: 'currently_due',
    },
  });
}
