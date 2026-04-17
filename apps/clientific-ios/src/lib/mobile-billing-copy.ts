export function getAiReceptionistUpgradeSummary(
  provider: 'stripe' | 'app_store',
): string {
  return provider === 'app_store'
    ? 'AI phone coverage is available on Pro and Premium. This account is managed through Apple, so subscription changes will stay tied to the App Store.'
    : 'AI phone coverage is available on Pro and Premium. This account currently bills on the web, so plan changes still happen there.';
}
