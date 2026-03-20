import { describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

import LegacyBillingRedirectPage from './page';

describe('LegacyBillingRedirectPage', () => {
  it('redirects the legacy dashboard billing route to the settings billing page', () => {
    LegacyBillingRedirectPage();

    expect(redirect).toHaveBeenCalledWith('/dashboard/settings/billing');
  });
});
