import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-session', () => ({
  getBearerToken: vi.fn(),
  verifyMobileSessionToken: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('@/lib/subscription', () => ({
  getSubscriptionInfo: vi.fn(),
}));
vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      retrieve: vi.fn(),
    },
    invoices: {
      list: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getSubscriptionInfo } from '@/lib/subscription';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { GET } from './route';

const mockGetBearerToken = getBearerToken as ReturnType<typeof vi.fn>;
const mockVerifyMobileSessionToken = verifyMobileSessionToken as ReturnType<typeof vi.fn>;
const mockFindBusiness = prisma.business.findUnique as ReturnType<typeof vi.fn>;
const mockGetSubscriptionInfo = getSubscriptionInfo as ReturnType<typeof vi.fn>;
const mockRetrieveSubscription = stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>;
const mockListInvoices = stripe.invoices.list as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBearerToken.mockReturnValue('token');
  mockVerifyMobileSessionToken.mockResolvedValue({ businessId: 'biz-1' });
});

describe('GET /api/mobile/billing', () => {
  it('returns billing plan, payment method, and invoice history', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      billingProvider: 'stripe',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    });
    mockGetSubscriptionInfo.mockResolvedValue({
      subscriptionPlan: 'starter',
      subscriptionStatus: 'active',
      billingProvider: 'stripe',
      trialDaysRemaining: null,
      trialEndsAt: null,
      subscriptionCurrentPeriodEnd: new Date('2026-04-30T00:00:00.000Z').toISOString(),
      stripeCurrentPeriodEnd: new Date('2026-04-30T00:00:00.000Z').toISOString(),
    });
    mockRetrieveSubscription.mockResolvedValue({
      default_payment_method: {
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2028,
        },
      },
    });
    mockListInvoices.mockResolvedValue({
      data: [
        {
          id: 'inv-1',
          amount_paid: 4900,
          amount_due: 0,
          currency: 'usd',
          created: 1774828800,
          status: 'paid',
          lines: { data: [{ description: 'Starter plan' }] },
          hosted_invoice_url: 'https://stripe.com/invoice/inv-1',
          invoice_pdf: undefined,
        },
      ],
    });

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/billing', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.currentPlanName).toBe('Starter');
    expect(body.billingProvider).toBe('stripe');
    expect(body.managementTitle).toBe('Managed on the web');
    expect(body.paymentMethod).toMatchObject({
      label: 'VISA ending in 4242',
    });
    expect(body.invoices[0]).toMatchObject({
      id: 'inv-1',
      amountLabel: '$49.00',
      hostedInvoiceUrl: 'https://stripe.com/invoice/inv-1',
      invoicePdf: null,
    });
  });

  it('returns a safe not-found response when subscription details are unavailable', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      billingProvider: 'stripe',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
    mockGetSubscriptionInfo.mockResolvedValue(null);

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/billing', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Unable to load billing' });
  });

  it('skips Stripe lookups for app store-managed subscriptions', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      billingProvider: 'app_store',
      stripeCustomerId: 'cus_stale',
      stripeSubscriptionId: 'sub_stale',
    });
    mockGetSubscriptionInfo.mockResolvedValue({
      subscriptionPlan: 'pro',
      subscriptionStatus: 'active',
      billingProvider: 'app_store',
      trialDaysRemaining: null,
      trialEndsAt: null,
      subscriptionCurrentPeriodEnd: new Date('2026-05-03T00:00:00.000Z').toISOString(),
      stripeCurrentPeriodEnd: null,
    });

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/billing', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockRetrieveSubscription).not.toHaveBeenCalled();
    expect(mockListInvoices).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.billingProvider).toBe('app_store');
    expect(body.billingProviderLabel).toBe('App Store');
    expect(body.managementTitle).toBe('Managed by Apple');
    expect(body.paymentMethod).toBeNull();
    expect(body.paymentMethodSummary).toBe('Payment details stay managed by Apple.');
    expect(body.invoiceEmptyState).toMatch(/receipts/i);
  });

  it('returns an in-app purchase state for inactive iPhone businesses', async () => {
    mockFindBusiness.mockResolvedValue({
      id: 'biz-1',
      email: 'owner@clientific.app',
      name: 'Clientific Studio',
      businessType: 'Salon',
      phone: '+15551234567',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'US',
      billingProvider: 'none',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    });
    mockGetSubscriptionInfo.mockResolvedValue({
      subscriptionPlan: 'trial',
      subscriptionStatus: 'inactive',
      billingProvider: 'none',
      isActive: false,
      trialDaysRemaining: null,
      trialEndsAt: null,
      subscriptionCurrentPeriodEnd: null,
      stripeCurrentPeriodEnd: null,
    });

    const response = await GET(
      new Request('https://www.clientific.app/api/mobile/billing', {
        headers: { authorization: 'Bearer token' },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.currentPlanName).toBe('No active plan');
    expect(body.billingProvider).toBe('none');
    expect(body.canPurchaseInApp).toBe(true);
    expect(body.showManageInApp).toBe(false);
    expect(body.managementTitle).toBe('Start your App Store trial');
  });
});
