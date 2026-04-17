export function getAiReceptionistUpgradeSummary(
  provider: 'none' | 'stripe' | 'app_store',
): string {
  return provider === 'app_store'
    ? 'AI phone coverage is available on Pro and Premium. This account is managed through Apple, so subscription changes will stay tied to the App Store.'
    : provider === 'none'
      ? 'AI phone coverage is available on Pro and Premium. Start the App Store trial from Billing first, then choose the plan that fits your business.'
    : 'AI phone coverage is available on Pro and Premium. This account currently bills on the web, so plan changes still happen there.';
}
