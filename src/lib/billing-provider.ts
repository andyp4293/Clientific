export type BillingProvider = 'stripe' | 'app_store';

export function normalizeBillingProvider(
  provider: string | null | undefined,
): BillingProvider {
  const normalized = typeof provider === 'string' ? provider.trim().toLowerCase() : '';

  return normalized === 'app_store' ? 'app_store' : 'stripe';
}

export function getBillingProviderLabel(
  provider: string | null | undefined,
): string {
  return normalizeBillingProvider(provider) === 'app_store' ? 'App Store' : 'Website';
}

export function getBillingManagementTitle(
  provider: string | null | undefined,
): string {
  return normalizeBillingProvider(provider) === 'app_store'
    ? 'Managed by Apple'
    : 'Managed on the web';
}

export function getBillingManagementSummary(
  provider: string | null | undefined,
): string {
  return normalizeBillingProvider(provider) === 'app_store'
    ? 'This account is billed through the App Store. Purchases, renewals, and receipts stay managed by Apple.'
    : 'This account started on the web. Plan changes and subscription management still happen in Clientific on the web.';
}

export function getBillingPaymentMethodSummary(
  provider: string | null | undefined,
  paymentMethodLabel: string | null | undefined,
): string {
  if (normalizeBillingProvider(provider) === 'app_store') {
    return 'Payment details stay managed by Apple.';
  }

  return paymentMethodLabel?.trim() || 'No card saved yet';
}

export function getBillingInvoiceEmptyState(
  provider: string | null | undefined,
): string {
  return normalizeBillingProvider(provider) === 'app_store'
    ? 'App Store receipts stay available from Apple for this subscription.'
    : 'No invoices have posted yet.';
}

export function getAiReceptionistUpgradeSummary(
  provider: string | null | undefined,
): string {
  return normalizeBillingProvider(provider) === 'app_store'
    ? 'AI phone coverage is available on Pro and Premium. This account is managed through Apple, so subscription changes will stay tied to the App Store.'
    : 'AI phone coverage is available on Pro and Premium. This account currently bills on the web, so plan changes still happen there.';
}
