import { APP_NAME } from './brand';

export const AUTO_RENEWAL_DISCLOSURE_TITLE = 'Auto-renewal disclosure';
export const DEFAULT_TRIAL_DAYS = 14;

type BillingInterval = 'monthly' | 'yearly';

type AutoRenewalDisclosureInput = {
  planName: string;
  price: number;
  interval?: BillingInterval;
  trialDays?: number | null;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);
}

function getIntervalLabel(interval: BillingInterval) {
  return interval === 'yearly' ? 'year' : 'month';
}

export function getAutoRenewalDisclosure({
  planName,
  price,
  interval = 'monthly',
  trialDays = DEFAULT_TRIAL_DAYS,
}: AutoRenewalDisclosureInput) {
  const intervalLabel = getIntervalLabel(interval);
  const trialCopy =
    typeof trialDays === 'number' && trialDays > 0
      ? `${planName} starts with a ${trialDays}-day free trial. After the trial, ${APP_NAME}`
      : `${planName} starts when checkout is completed. ${APP_NAME}`;

  return `${trialCopy} automatically charges ${formatPrice(
    price,
  )}/${intervalLabel} plus applicable taxes until you cancel. Your subscription renews ${
    interval === 'yearly' ? 'yearly' : 'monthly'
  } unless canceled before the next billing date. You can cancel anytime in Billing; access continues until the end of the current paid period.`;
}

export function getCheckoutAuthorizationDisclosure(input: AutoRenewalDisclosureInput) {
  return `By continuing to checkout, you authorize recurring billing. ${getAutoRenewalDisclosure(
    input,
  )}`;
}
