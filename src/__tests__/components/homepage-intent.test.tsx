import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import HomePage from '@/app/page';

const mockUseSession = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

describe('Homepage audience intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'shows explicit business and customer paths for unauthenticated visitors',
    async () => {
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
    render(<HomePage />);

    expect(await screen.findByText('Start with the workflow you need')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Set up my business' })).toHaveAttribute(
      'href',
      '/register'
    );
    expect(await screen.findByRole('link', { name: 'See customer booking' })).toHaveAttribute(
      'href',
      '/explore'
    );
    },
    15000
  );

  it('routes authenticated business users to dashboard from the business path CTA', async () => {
    mockUseSession.mockReturnValue({ status: 'authenticated', data: { user: { id: 'biz-1' } } });
    render(<HomePage />);

    expect(await screen.findByRole('link', { name: 'Set up my business' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });

  it('links homepage conversion and support actions to real destinations', async () => {
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
    render(<HomePage />);

    expect(await screen.findByRole('link', { name: 'View Pricing' })).toHaveAttribute(
      'href',
      '/pricing'
    );
    expect(screen.getByRole('link', { name: 'Questions? support@clientific.app' })).toHaveAttribute(
      'href',
      '/support'
    );
  });

  it('renders four quick-stat cards in the responsive stats section', async () => {
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
    render(<HomePage />);

    const statsSection = await screen.findByTestId('homepage-quick-stats');
    const statCards = await screen.findAllByTestId('homepage-quick-stat-card');

    expect(statsSection).toBeInTheDocument();
    expect(statCards).toHaveLength(4);
    expect(within(statsSection).getByText('14-day trial')).toBeInTheDocument();
    expect(within(statsSection).getByText('No customer app required')).toBeInTheDocument();
    expect(screen.queryByText('99.9%')).not.toBeInTheDocument();
    expect(screen.queryByText('< 3 min')).not.toBeInTheDocument();
  });
});
