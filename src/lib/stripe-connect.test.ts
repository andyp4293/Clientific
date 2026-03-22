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
  isRecoverableConnectAccountError,
} from './stripe-connect';

const mockBusinessUpdate = prisma.business.update as ReturnType<typeof vi.fn>;
const mockBankDeleteMany = prisma.businessBankAccount.deleteMany as ReturnType<typeof vi.fn>;
const mockAccountRetrieve = stripe.accounts.retrieve as ReturnType<typeof vi.fn>;
const mockAccountCreate = stripe.accounts.create as ReturnType<typeof vi.fn>;
const mockAccountUpdate = stripe.accounts.update as ReturnType<typeof vi.fn>;
const mockAccountLinkCreate = stripe.accountLinks.create as ReturnType<typeof vi.fn>;
const mockAccountSessionCreate = stripe.accountSessions.create as ReturnType<typeof vi.fn>;

const business = {
  id: 'biz-1',
  email: 'owner@example.com',
  name: 'Test Salon',
  phone: '(555) 111-2222',
  businessEmail: 'hello@testsalon.com',
  publicId: 'CF-66W551',
  slug: 'test-salon',
  stripeConnectAccountId: 'acct_old',
};

const createdAccount = {
  id: 'acct_new',
  type: 'none',
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
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
    controller: {
      losses: { payments: 'stripe' },
      requirement_collection: 'stripe',
      stripe_dashboard: { type: 'none' },
    },
    business_profile: params.business_profile,
    settings: params.settings,
  }));
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
        controller: expect.objectContaining({
          stripe_dashboard: { type: 'none' },
        }),
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
        controller: expect.objectContaining({
          stripe_dashboard: { type: 'none' },
        }),
      })
    );
  });

  it('refreshes incomplete embedded accounts with the latest business profile details before reusing them', async () => {
    const existingAccount = {
      id: 'acct_current',
      type: 'none',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      controller: {
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'none' },
      },
    };
    mockAccountRetrieve.mockResolvedValue(existingAccount);

    const account = await ensureBusinessConnectAccount(business, 'https://clientific.app');

    expect(account).toEqual(
      expect.objectContaining({
        id: 'acct_current',
        business_profile: expect.objectContaining({
          name: 'Test Salon',
          support_email: 'hello@testsalon.com',
          support_phone: '+15551112222',
          url: 'https://clientific.app/business/CF-66W551',
        }),
        settings: expect.objectContaining({
          payments: expect.objectContaining({
            statement_descriptor: 'TEST SALON',
          }),
        }),
      })
    );
    expect(mockAccountUpdate).toHaveBeenCalledWith(
      'acct_current',
      expect.objectContaining({
        business_profile: expect.objectContaining({
          name: 'Test Salon',
          support_email: 'hello@testsalon.com',
          support_phone: '+15551112222',
          url: 'https://clientific.app/business/CF-66W551',
        }),
        settings: expect.objectContaining({
          payments: expect.objectContaining({
            statement_descriptor: 'TEST SALON',
          }),
        }),
      })
    );
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
  it('creates a hosted onboarding link that collects eventually due requirements', async () => {
    await createConnectOnboardingLink({
      accountId: 'acct_hosted',
      refreshUrl: 'https://clientific.app/api/stripe/connect/onboarding-link/refresh',
      returnUrl: 'https://clientific.app/dashboard/payouts/setup?stripe_onboarding=return',
    });

    expect(mockAccountLinkCreate).toHaveBeenCalledWith({
      account: 'acct_hosted',
      refresh_url: 'https://clientific.app/api/stripe/connect/onboarding-link/refresh',
      return_url: 'https://clientific.app/dashboard/payouts/setup?stripe_onboarding=return',
      type: 'account_onboarding',
      collection_options: {
        fields: 'eventually_due',
      },
    });
  });
});
