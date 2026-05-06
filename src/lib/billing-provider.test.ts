import {
  getAiReceptionistUpgradeSummary,
  getBillingInvoiceEmptyState,
  getBillingManagementSummary,
  getBillingManagementTitle,
  getBillingPaymentMethodSummary,
  getBillingProviderLabel,
  normalizeBillingProvider,
} from './billing-provider';

describe('billing-provider helpers', () => {
  it('defaults unknown providers to stripe for existing web accounts', () => {
    expect(normalizeBillingProvider(null)).toBe('stripe');
    expect(normalizeBillingProvider(undefined)).toBe('stripe');
    expect(normalizeBillingProvider('unknown')).toBe('stripe');
  });

  it('preserves the App Store provider', () => {
    expect(normalizeBillingProvider('app_store')).toBe('app_store');
    expect(getBillingProviderLabel('app_store')).toBe('App Store');
  });

  it('preserves the no-subscription placeholder provider for iPhone onboarding', () => {
    expect(normalizeBillingProvider('none')).toBe('none');
    expect(getBillingProviderLabel('none')).toBe('No subscription yet');
    expect(getBillingManagementTitle('none')).toBe('Start your App Store trial');
    expect(getBillingManagementSummary('none')).toContain(
      'Starter unlocks booking, CRM, reminders, analytics, deals, referrals, and secure payouts.',
    );
    expect(getBillingManagementSummary('none')).toContain(
      'Pro and Premium also add AI receptionist phone coverage.',
    );
    expect(getBillingPaymentMethodSummary('none', null)).toMatch(/Apple/i);
    expect(getBillingInvoiceEmptyState('none')).toMatch(/start billing/i);
    expect(getAiReceptionistUpgradeSummary('none')).toMatch(/Billing/i);
  });

  it('returns website management copy for stripe-backed businesses', () => {
    expect(getBillingProviderLabel('stripe')).toBe('Website');
    expect(getBillingManagementTitle('stripe')).toBe('Managed on the web');
    expect(getBillingManagementSummary('stripe')).toMatch(/started on the web/i);
    expect(getBillingPaymentMethodSummary('stripe', 'VISA ending in 4242')).toBe(
      'VISA ending in 4242',
    );
    expect(getBillingPaymentMethodSummary('stripe', null)).toBe('No card saved yet');
    expect(getBillingInvoiceEmptyState('stripe')).toBe('No invoices have posted yet.');
    expect(getAiReceptionistUpgradeSummary('stripe')).toMatch(/bills on the web/i);
  });

  it('returns Apple-managed copy for app store subscriptions', () => {
    expect(getBillingManagementTitle('app_store')).toBe('Managed by Apple');
    expect(getBillingManagementSummary('app_store')).toMatch(/managed by Apple/i);
    expect(getBillingPaymentMethodSummary('app_store', 'ignored')).toBe(
      'Payment details stay managed by Apple.',
    );
    expect(getBillingInvoiceEmptyState('app_store')).toMatch(/receipts/i);
    expect(getAiReceptionistUpgradeSummary('app_store')).toMatch(/App Store/i);
  });
});
