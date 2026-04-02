import { describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (href: string) => mockRedirect(href),
}));

import CampaignsRedirectPage from './page';

describe('CampaignsRedirectPage', () => {
  it('redirects the legacy campaigns route to deals', () => {
    CampaignsRedirectPage();

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/deals');
  });
});
