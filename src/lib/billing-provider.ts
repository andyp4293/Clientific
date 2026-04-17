export type BillingProvider = 'none' | 'stripe' | 'app_store';

export function normalizeBillingProvider(
  provider: string | null | undefined,
): BillingProvider {
  const normalized = typeof provider === 'string' ? provider.trim().toLowerCase() : '';

  if (normalized === 'none') {
    return 'none';
  }

  return normalized === 'app_store' ? 'app_store' : 'stripe';
}

export function getBillingProviderLabel(
  provider: string | null | undefined,
): string {
  const normalized = normalizeBillingProvider(provider);

  if (normalized === 'none') {
    return 'No subscription yet';
  }

  return normalized === 'app_store' ? 'App Store' : 'Website';
}

export function getBillingManagementTitle(
  provider: string | null | undefined,
): string {
  const normalized = normalizeBillingProvider(provider);

  if (normalized === 'none') {
    return 'Start your App Store trial';
  }

  return normalized === 'app_store' ? 'Managed by Apple' : 'Managed on the web';
}

export function getBillingManagementSummary(
  provider: string | null | undefined,
): string {
  const normalized = normalizeBillingProvider(provider);

  if (normalized === 'none') {
    return 'This iPhone account has not started a subscription yet. Pick a plan in the app to unlock appointments, customers, deals, and the rest of the business tools.';
  }

  return normalized === 'app_store'
    ? 'This account is billed through the App Store. Purchases, renewals, and receipts stay managed by Apple.'
    : 'This account started on the web. Plan changes and subscription management still happen in Clientific on the web.';
}

export function getBillingPaymentMethodSummary(
  provider: string | null | undefined,
  paymentMethodLabel: string | null | undefined,
): string {
  const normalized = normalizeBillingProvider(provider);

  if (normalized === 'app_store') {
    return 'Payment details stay managed by Apple.';
  }

  if (normalized === 'none') {
    return 'No Apple App Store subscription yet.';
  }

  return paymentMethodLabel?.trim() || 'No card saved yet';
}

export function getBillingInvoiceEmptyState(
  provider: string | null | undefined,
): string {
  const normalized = normalizeBillingProvider(provider);

  if (normalized === 'app_store') {
    return 'App Store receipts stay available from Apple for this subscription.';
  }

  if (normalized === 'none') {
    return 'No App Store receipts yet. Start billing in the App Store to unlock them.';
  }

  return 'No invoices have posted yet.';
}

export function getAiReceptionistUpgradeSummary(
  provider: string | null | undefined,
): string {
  const normalized = normalizeBillingProvider(provider);

  if (normalized === 'app_store') {
    return 'AI phone coverage is available on Pro and Premium. This account is managed through Apple, so subscription changes will stay tied to the App Store.';
  }

  if (normalized === 'none') {
    return 'AI phone coverage is available on Pro and Premium. Start an App Store plan in Billing first, then you can turn it on here.';
  }

  return 'AI phone coverage is available on Pro and Premium. This account currently bills on the web, so plan changes still happen there.';
}
