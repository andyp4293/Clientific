import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

describe('PublicSiteHeader', () => {
  it('renders primary navigation and default CTA', () => {
    render(<PublicSiteHeader />);

    expect(screen.getByRole('link', { name: /Clientific/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Explore Deals' })).toHaveAttribute('href', '/explore');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: 'Partner Program' })).toHaveAttribute('href', '/partner');
    expect(screen.getByRole('link', { name: 'List Your Business' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Log In' })).toHaveAttribute('href', '/login');
  });

  it('hides login link when showLogin is false', () => {
    render(<PublicSiteHeader showLogin={false} />);
    expect(screen.queryByRole('link', { name: 'Log In' })).not.toBeInTheDocument();
  });

  it('supports custom CTA', () => {
    render(<PublicSiteHeader ctaLabel="Dashboard" ctaHref="/dashboard" />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it.each(['explore', 'business', 'deal', 'book'] as const)(
    'marks Explore Deals as active when active=%s',
    (active) => {
      render(<PublicSiteHeader active={active} />);

      expect(screen.getByRole('link', { name: 'Explore Deals' })).not.toHaveClass('text-gray-500');
      expect(screen.getByRole('link', { name: 'Pricing' })).toHaveClass('text-gray-500');
      expect(screen.getByRole('link', { name: 'Partner Program' })).toHaveClass('text-gray-500');
    }
  );

  it('marks Pricing as active when active=pricing', () => {
    render(<PublicSiteHeader active="pricing" />);

    expect(screen.getByRole('link', { name: 'Pricing' })).not.toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'Explore Deals' })).toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'Partner Program' })).toHaveClass('text-gray-500');
  });

  it('marks Partner Program as active when active=partner', () => {
    render(<PublicSiteHeader active="partner" />);

    expect(screen.getByRole('link', { name: 'Partner Program' })).not.toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'Explore Deals' })).toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveClass('text-gray-500');
  });
});
