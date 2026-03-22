import { describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import PayoutsSetupPage from './page';

describe('PayoutsSetupPage', () => {
  it('redirects the legacy setup route to the main payouts page', async () => {
    await expect(
      PayoutsSetupPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('REDIRECT:/dashboard/payouts');
  });

  it('preserves Stripe onboarding query params when bouncing to payouts', async () => {
    await expect(
      PayoutsSetupPage({
        searchParams: Promise.resolve({ stripe_onboarding: 'return' }),
      })
    ).rejects.toThrow('REDIRECT:/dashboard/payouts?stripe_onboarding=return');
  });
});
