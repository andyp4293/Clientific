// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpgradePricingCards } from './UpgradePricingCards';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('UpgradePricingCards', () => {
  it('shows auto-renewal terms beside each paid plan before checkout', () => {
    render(
      <UpgradePricingCards
        status="inactive"
        hasStripeCustomer={false}
        trialExpired={false}
      />,
    );

    expect(screen.getAllByText('Auto-renewal disclosure')).toHaveLength(3);
    expect(
      screen.getByTestId('upgrade-auto-renewal-disclosure-starter'),
    ).toHaveTextContent(
      'Starter starts with a 14-day free trial. After the trial, Clientific automatically charges $39/month plus applicable taxes until you cancel.',
    );
    expect(screen.getByTestId('upgrade-auto-renewal-disclosure-pro')).toHaveTextContent(
      'Your subscription renews monthly unless canceled before the next billing date.',
    );
    expect(screen.getByTestId('upgrade-auto-renewal-disclosure-premium')).toHaveTextContent(
      'You can cancel anytime in Billing; access continues until the end of the current paid period.',
    );
  });
});
