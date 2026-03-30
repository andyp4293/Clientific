import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      update: vi.fn(),
    },
    businessBankAccount: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: {
      retrieve: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    balanceSettings: {
      retrieve: vi.fn(),
      update: vi.fn(),
    },
    accountLinks: {
      create: vi.fn(),
    },
    accountSessions: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  createConnectOnboardingLink,
  createConnectAccountSession,
  ensureBusinessConnectAccount,
  fetchConnectAccountStatus,
  isRecoverableConnectAccountError,
  syncBusinessConnectState,
} from './stripe-connect';

const mockBusinessUpdate = prisma.business.update as ReturnType<typeof vi.fn>;
const mockBankDeleteMany = prisma.businessBankAccount.deleteMany as ReturnType<typeof vi.fn>;
const mockAccountRetrieve = stripe.accounts.retrieve as ReturnType<typeof vi.fn>;
const mockAccountCreate = stripe.accounts.create as ReturnType<typeof vi.fn>;
const mockAccountUpdate = stripe.accounts.update as ReturnType<typeof vi.fn>;
const mockBalanceSettingsRetrieve = stripe.balanceSettings.retrieve as ReturnType<typeof vi.fn>;
const mockBalanceSettingsUpdate = stripe.balanceSettings.update as ReturnType<typeof vi.fn>;
const mockAccountLinkCreate = stripe.accountLinks.create as ReturnType<typeof vi.fn>;
const mockAccountSessionCreate = stripe.accountSessions.create as ReturnType<typeof vi.fn>;

const business = {
  id: 'biz-1',
  email: 'owner@example.com',
  name: 'Test Salon',
  ownerPhone: '(555) 999-0000',
  phone: '(555) 111-2222',
  businessEmail: 'hello@testsalon.com',
  publicId: 'CF-66W551',
  slug: 'test-salon',
  stripeConnectAccountId: 'acct_old',
};

const createdAccount = {
  id: 'acct_new',
  type: 'none',
  business_type: 'individual',
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  capabilities: {
    card_payments: 'inactive',
    transfers: 'inactive',
  },
  controller: {
    losses: { payments: 'stripe' },
    requirement_collection: 'stripe',
    stripe_dashboard: { type: 'none' },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBusinessUpdate.mockResolvedValue({});
  mockBankDeleteMany.mockResolvedValue({ count: 1 });
  mockAccountCreate.mockResolvedValue(createdAccount);
  mockAccountUpdate.mockImplementation(async (accountId, params) => ({
    id: accountId,
    type: 'none',
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    capabilities: {
      card_payments: 'inactive',
      transfers: 'inactive',
    },
    controller: {
      losses: { payments: 'stripe' },
      requirement_collection: 'stripe',
      stripe_dashboard: { type: 'none' },
    },
    business_profile: params.business_profile,
    settings: params.settings,
  }));
  mockBalanceSettingsRetrieve.mockResolvedValue({
    payments: {
      payouts: {
        schedule: {
          interval: 'manual',
          monthly_payout_days: [],
          weekly_payout_days: [],
        },
        statement_descriptor: 'TEST SALON',
      },
    },
  });
  mockBalanceSettingsUpdate.mockResolvedValue({
    payments: {
      payouts: {
        schedule: {
          interval: 'manual',
          monthly_payout_days: [],
          weekly_payout_days: [],
        },
        statement_descriptor: 'CLIENTIFIC',
      },
    },
  });
  mockAccountLinkCreate.mockResolvedValue({ url: 'https://connect.stripe.test/onboarding' });
  mockAccountSessionCreate.mockResolvedValue({ client_secret: 'cas_test_secret' });
});

describe('isRecoverableConnectAccountError', () => {
  it('treats missing or invalid accounts as recoverable', () => {
    expect(isRecoverableConnectAccountError({ code: 'resource_missing' })).toBe(true);
    expect(isRecoverableConnectAccountError({ code: 'account_invalid' })).toBe(true);
    expect(isRecoverableConnectAccountError({ code: 'permission_error' })).toBe(false);
  });
});

describe('ensureBusinessConnectAccount', () => {
  it('recreates the connected account when Stripe access has gone stale', async () => {
    mockAccountRetrieve.mockRejectedValue({ code: 'account_invalid' });

    const account = await ensureBusinessConnectAccount(business, 'https://clientific.app');

    expect(account).toEqual(createdAccount);
    expect(mockAccountRetrieve).toHaveBeenCalledWith('acct_old');
    expect(mockBankDeleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz-1' } });
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        business_profile: expect.objectContaining({
          name: 'Test Salon',
          support_email: 'hello@testsalon.com',
          support_phone: '+15551112222',
          url: 'https://clientific.app/business/CF-66W551',
        }),
        business_type: 'individual',
        controller: expect.objectContaining({
          stripe_dashboard: { type: 'none' },
        }),
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        settings: {
          payouts: {
            statement_descriptor: 'CLIENTIFIC',
            schedule: {
              interval: 'manual',
            },
          },
        },
        email: 'owner@example.com',
        metadata: expect.objectContaining({ businessId: 'biz-1' }),
      })
    );
    expect(mockBusinessUpdate).toHaveBeenCalledTimes(2);
  });

  it('recreates unfinished legacy custom accounts so embedded onboarding can use the current Stripe setup', async () => {
    mockAccountRetrieve.mockResolvedValue({
      id: 'acct_old',
      type: 'custom',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      controller: {
        losses: { payments: 'application' },
        requirement_collection: 'application',
        stripe_dashboard: { type: 'none' },
      },
    });

    const account = await ensureBusinessConnectAccount(business, 'https://clientific.app');

    expect(account).toEqual(createdAccount);
    expect(mockBankDeleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz-1' } });
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        business_profile: expect.objectContaining({
          name: 'Test Salon',
          support_email: 'hello@testsalon.com',
          support_phone: '+15551112222',
          url: 'https://clientific.app/business/CF-66W551',
        }),
        business_type: 'individual',
        controller: expect.objectContaining({
          stripe_dashboard: { type: 'none' },
        }),
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
    );
  });

  it('recreates stripe-managed incomplete unsupported recipient accounts into the supported lighter onboarding flow', async () => {
    const existingAccount = {
      id: 'acct_current',
      type: 'none',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      capabilities: {
        card_payments: 'inactive',
        transfers: 'inactive',
      },
      controller: {
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'none' },
      },
      tos_acceptance: {
        service_agreement: 'recipient',
      },
    };
    mockAccountRetrieve.mockResolvedValue(existingAccount);

    const account = await ensureBusinessConnectAccount(business, 'https://clientific.app');

    expect(account).toEqual(createdAccount);
    expect(mockAccountUpdate).not.toHaveBeenCalled();
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: expect.objectContaining({
          payoutSetupMode: 'individual_currently_due_only',
        }),
      })
    );
    expect(mockBankDeleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz-1' } });
    expect(mockBusinessUpdate).toHaveBeenCalledTimes(2);
  });

  it('recreates unfinished non-individual accounts into the individual-owner flow', async () => {
    const existingAccount = {
      id: 'acct_current',
      type: 'none',
      business_type: 'company',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      capabilities: {
        card_payments: 'inactive',
        transfers: 'inactive',
      },
      controller: {
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'none' },
      },
    };
    mockAccountRetrieve.mockResolvedValue(existingAccount);

    const account = await ensureBusinessConnectAccount(business, 'https://clientific.app');

    expect(account).toEqual(createdAccount);
    expect(mockAccountUpdate).not.toHaveBeenCalled();
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        business_type: 'individual',
      })
    );
    expect(mockBankDeleteMany).toHaveBeenCalledWith({ where: { businessId: 'biz-1' } });
    expect(mockBusinessUpdate).toHaveBeenCalledTimes(2);
  });

  it('reuses stripe-managed incomplete individual accounts without patching restricted fields', async () => {
    const existingAccount = {
      id: 'acct_current',
      type: 'none',
      business_type: 'individual',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      capabilities: {
        card_payments: 'inactive',
        transfers: 'inactive',
      },
      controller: {
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'none' },
      },
    };
    mockAccountRetrieve.mockResolvedValue(existingAccount);

    const account = await ensureBusinessConnectAccount(business, 'https://clientific.app');

    expect(account).toEqual(existingAccount);
    expect(mockAccountUpdate).not.toHaveBeenCalled();
    expect(mockAccountCreate).not.toHaveBeenCalled();
    expect(mockBankDeleteMany).not.toHaveBeenCalled();
    expect(mockBusinessUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps a fully ready embedded account without patching it again', async () => {
    const readyAccount = {
      id: 'acct_ready',
      type: 'none',
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      controller: {
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'none' },
      },
    };
    mockAccountRetrieve.mockResolvedValue(readyAccount);

    const account = await ensureBusinessConnectAccount(business, 'https://clientific.app');

    expect(account).toEqual(readyAccount);
    expect(mockAccountUpdate).not.toHaveBeenCalled();
    expect(mockAccountCreate).not.toHaveBeenCalled();
    expect(mockBankDeleteMany).not.toHaveBeenCalled();
    expect(mockBusinessUpdate).toHaveBeenCalledTimes(1);
  });

  it('uses the owner phone as a support-phone fallback when no business phone is set', async () => {
    mockAccountRetrieve.mockRejectedValue({ code: 'account_invalid' });

    await ensureBusinessConnectAccount(
      {
        ...business,
        phone: null,
      },
      'https://clientific.app'
    );

    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        business_profile: expect.objectContaining({
          support_phone: '+15559990000',
        }),
      })
    );
  });
});

describe('createConnectAccountSession', () => {
  it('keeps Stripe authentication enabled for Stripe-managed embedded accounts', async () => {
    await createConnectAccountSession({
      id: 'acct_stripe_managed',
      type: 'none',
      controller: {
        requirement_collection: 'stripe',
      },
    } as any);

    expect(mockAccountSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'acct_stripe_managed',
        components: expect.objectContaining({
          account_onboarding: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: false,
            }),
          }),
          account_management: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: false,
            }),
          }),
          notification_banner: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: false,
            }),
          }),
          balances: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: false,
            }),
          }),
          payouts: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: false,
            }),
          }),
        }),
      })
    );
  });

  it('disables Stripe authentication only for application-managed custom accounts', async () => {
    await createConnectAccountSession({
      id: 'acct_custom',
      type: 'custom',
      controller: {
        requirement_collection: 'application',
      },
    } as any);

    expect(mockAccountSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'acct_custom',
        components: expect.objectContaining({
          account_onboarding: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: true,
            }),
          }),
          account_management: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: true,
            }),
          }),
          notification_banner: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: true,
            }),
          }),
          balances: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: true,
            }),
          }),
          payouts: expect.objectContaining({
            features: expect.objectContaining({
              disable_stripe_user_authentication: true,
            }),
          }),
        }),
      })
    );
  });
});

describe('createConnectOnboardingLink', () => {
  it('creates a hosted onboarding link that collects only currently due requirements', async () => {
    await createConnectOnboardingLink({
      accountId: 'acct_hosted',
      refreshUrl: 'https://clientific.app/api/stripe/connect/onboarding-link/refresh',
      returnUrl: 'https://clientific.app/dashboard/payouts?stripe_onboarding=return',
    });

    expect(mockAccountLinkCreate).toHaveBeenCalledWith({
      account: 'acct_hosted',
      refresh_url: 'https://clientific.app/api/stripe/connect/onboarding-link/refresh',
      return_url: 'https://clientific.app/dashboard/payouts?stripe_onboarding=return',
      type: 'account_onboarding',
      collection_options: {
        fields: 'currently_due',
      },
    });
  });
});

describe('fetchConnectAccountStatus', () => {
  it('treats recipient transfer-only accounts as payout-ready when transfers are active', async () => {
    mockAccountRetrieve.mockResolvedValue({
      id: 'acct_recipient',
      charges_enabled: false,
      payouts_enabled: true,
      details_submitted: true,
      capabilities: {
        transfers: 'active',
      },
      external_accounts: {
        data: [
          {
            object: 'bank_account',
            id: 'ba_123',
            bank_name: 'Chase',
            last4: '6789',
            routing_number: '110000000',
            account_holder_name: 'Test Salon',
            default_for_currency: true,
            status: 'verified',
          },
        ],
      },
      requirements: {
        currently_due: [],
        eventually_due: [],
        past_due: [],
        pending_verification: [],
        disabled_reason: null,
      },
    });

    const status = await fetchConnectAccountStatus('acct_recipient');

    expect(mockAccountRetrieve).toHaveBeenCalledWith('acct_recipient', {
      expand: ['external_accounts'],
    });
    expect(status.chargesEnabled).toBe(true);
    expect(status.onboardingComplete).toBe(true);
    expect(status.bankAccountConnected).toBe(true);
    expect(status.externalAccount?.last4).toBe('6789');
  });
});

describe('syncBusinessConnectState', () => {
  it('does not retry immutable account-level statement descriptor updates after activation', async () => {
    mockAccountRetrieve
      .mockResolvedValueOnce({
        id: 'acct_live',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        capabilities: {
          transfers: 'active',
        },
        settings: {
          payouts: {
            statement_descriptor: 'ANDY PHAM',
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'acct_live',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        capabilities: {
          transfers: 'active',
        },
        external_accounts: {
          data: [],
        },
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
          disabled_reason: null,
        },
      });
    mockBalanceSettingsRetrieve.mockResolvedValue({
      payments: {
        payouts: {
          schedule: {
            interval: 'manual',
            monthly_payout_days: [],
            weekly_payout_days: [],
          },
          statement_descriptor: 'ANDY PHAM',
        },
      },
    });

    const status = await syncBusinessConnectState('biz-1', 'acct_live');

    expect(mockAccountUpdate).not.toHaveBeenCalled();
    expect(mockBalanceSettingsUpdate).toHaveBeenCalledWith(
      {
        payments: {
          payouts: {
            statement_descriptor: 'CLIENTIFIC',
          },
        },
      },
      {
        stripeAccount: 'acct_live',
      }
    );
    expect(status.payoutSchedule.statementDescriptor).toBe('CLIENTIFIC');
  });

  it('still updates the account-level statement descriptor before the account is activated', async () => {
    mockAccountRetrieve
      .mockResolvedValueOnce({
        id: 'acct_setup',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        capabilities: {
          transfers: 'inactive',
        },
        settings: {
          payouts: {
            statement_descriptor: 'ANDY PHAM',
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'acct_setup',
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        capabilities: {
          transfers: 'inactive',
        },
        external_accounts: {
          data: [],
        },
        requirements: {
          currently_due: [],
          eventually_due: [],
          past_due: [],
          pending_verification: [],
          disabled_reason: null,
        },
      });
    mockBalanceSettingsRetrieve.mockResolvedValue({
      payments: {
        payouts: {
          schedule: {
            interval: 'manual',
            monthly_payout_days: [],
            weekly_payout_days: [],
          },
          statement_descriptor: 'ANDY PHAM',
        },
      },
    });

    await syncBusinessConnectState('biz-1', 'acct_setup');

    expect(mockAccountUpdate).toHaveBeenCalledWith('acct_setup', {
      settings: {
        payouts: {
          statement_descriptor: 'CLIENTIFIC',
        },
      },
    });
    expect(mockBalanceSettingsUpdate).toHaveBeenCalledWith(
      {
        payments: {
          payouts: {
            statement_descriptor: 'CLIENTIFIC',
          },
        },
      },
      {
        stripeAccount: 'acct_setup',
      }
    );
  });
});
