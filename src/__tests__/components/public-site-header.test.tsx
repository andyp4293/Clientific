import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicSiteHeader } from '@/components/layout/PublicSiteHeader';

describe('PublicSiteHeader', () => {
  it('renders primary navigation and default CTA', () => {
    render(<PublicSiteHeader />);

    const loginLink = screen.getByRole('link', { name: 'Log In' });

    expect(screen.getByRole('link', { name: /Clientific/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'For Businesses' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'For Customers' })).toHaveAttribute('href', '/explore');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: 'Refer & Earn' })).toHaveAttribute('href', '/partner');
    expect(screen.getByRole('link', { name: 'Start Free Trial' })).toHaveAttribute('href', '/register');
    expect(loginLink).toHaveAttribute('href', '/login');
    expect(loginLink).toHaveClass('inline-flex');
    expect(loginLink).not.toHaveClass('hidden');
    expect(screen.getByRole('banner')).toHaveClass('bg-white/80');
    expect(screen.getByRole('banner')).toHaveClass('dark:bg-gray-950/90');
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
    'marks For Customers as active when active=%s',
    (active) => {
      render(<PublicSiteHeader active={active} />);

      expect(screen.getByRole('link', { name: 'For Customers' })).not.toHaveClass('text-gray-500');
      expect(screen.getByRole('link', { name: 'Pricing' })).toHaveClass('text-gray-500');
      expect(screen.getByRole('link', { name: 'Refer & Earn' })).toHaveClass('text-gray-500');
    }
  );

  it('marks For Businesses as active when active=home', () => {
    render(<PublicSiteHeader active="home" />);

    expect(screen.getByRole('link', { name: 'For Businesses' })).not.toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'For Customers' })).toHaveClass('text-gray-500');
  });

  it('marks Pricing as active when active=pricing', () => {
    render(<PublicSiteHeader active="pricing" />);

    expect(screen.getByRole('link', { name: 'Pricing' })).not.toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'For Customers' })).toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'Refer & Earn' })).toHaveClass('text-gray-500');
  });

  it('marks Refer & Earn as active when active=partner', () => {
    render(<PublicSiteHeader active="partner" />);

    expect(screen.getByRole('link', { name: 'Refer & Earn' })).not.toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'For Customers' })).toHaveClass('text-gray-500');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveClass('text-gray-500');
  });
});
