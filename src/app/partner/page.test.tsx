// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PartnerPage from './page';

vi.mock('@/components/layout/PublicSiteHeader', () => ({
  PublicSiteHeader: ({ active }: { active: string }) => (
    <div data-testid="public-site-header">{active}</div>
  ),
}));

describe('PartnerPage', () => {
  it('describes the recurring referral program accurately', () => {
    render(<PartnerPage />);

    expect(
      screen.getByRole('heading', {
        name: /earn 30% every month a referred business pays/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no paid clientific subscription is required to earn or collect payouts/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/built for content creators, salon consultants, local marketers/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/creator-ready tracking/i)).toBeInTheDocument();
    expect(
      screen.getByText(/referral sharing unlocks only after stripe payout setup is complete/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/earn \$15 for every business you refer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/we pay you \$15 directly/i)).not.toBeInTheDocument();
  });

  it('sends new partners into the real register flow', () => {
    render(<PartnerPage />);

    expect(
      screen.getByRole('link', { name: /create free referral account/i })
    ).toHaveAttribute('href', '/register?partner=1');
    expect(screen.getByRole('link', { name: /log in to referrals/i })).toHaveAttribute(
      'href',
      '/login'
    );
    expect(
      screen.getByText(/the dashboard referrals and payouts pages are the source of truth/i)
    ).toBeInTheDocument();
  });
});
