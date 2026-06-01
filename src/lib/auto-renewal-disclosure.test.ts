import { describe, expect, it } from 'vitest';
import {
  AUTO_RENEWAL_DISCLOSURE_TITLE,
  getAutoRenewalDisclosure,
  getCheckoutAuthorizationDisclosure,
} from './auto-renewal-disclosure';

describe('auto-renewal disclosure copy', () => {
  it('clearly discloses trial, price, renewal, cancellation, and access terms', () => {
    const disclosure = getAutoRenewalDisclosure({
      planName: 'Pro',
      price: 69,
    });

    expect(AUTO_RENEWAL_DISCLOSURE_TITLE).toBe('Auto-renewal disclosure');
    expect(disclosure).toContain('Pro starts with a 14-day free trial');
    expect(disclosure).toContain('automatically charges $69/month plus applicable taxes');
    expect(disclosure).toContain('renews monthly unless canceled before the next billing date');
    expect(disclosure).toContain('cancel anytime in Billing');
    expect(disclosure).toContain('access continues until the end of the current paid period');
  });

  it('adds explicit checkout authorization language', () => {
    expect(
      getCheckoutAuthorizationDisclosure({
        planName: 'Premium',
        price: 99,
      }),
    ).toMatch(/^By continuing to checkout, you authorize recurring billing\./);
  });

  it('does not promise a trial when checkout will charge immediately', () => {
    const disclosure = getAutoRenewalDisclosure({
      planName: 'Starter',
      price: 39,
      trialDays: null,
    });

    expect(disclosure).toContain('Starter starts when checkout is completed');
    expect(disclosure).toContain('automatically charges $39/month');
    expect(disclosure).not.toContain('free trial');
  });
});
