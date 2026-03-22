import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

const mockUseSession = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

describe('Homepage theme contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });
  });

  it('uses shared light and dark hero surfaces for the homepage, featured plan, and closing CTA', () => {
    render(<HomePage />);

    expect(screen.getByTestId('homepage-hero').className).toContain('home-hero-shell');
    expect(screen.getByTestId('homepage-hero-panel').className).toContain('home-hero-panel');
    expect(screen.getByTestId('homepage-featured-plan').className).toContain('from-primary-50');
    expect(screen.getByTestId('homepage-featured-plan').className).toContain('dark:from-gray-950');
    expect(screen.getByTestId('homepage-cta').className).toContain('from-primary-50');
    expect(screen.getByTestId('homepage-cta').className).toContain('dark:from-gray-950');
  });

  it('does not show unsupported social-proof business counts', () => {
    render(<HomePage />);

    expect(screen.queryByText(/Trusted by/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/500\+/)).not.toBeInTheDocument();
    expect(screen.queryByText('99.9%')).not.toBeInTheDocument();
    expect(screen.queryByText('< 3 min')).not.toBeInTheDocument();
    expect(screen.queryByText('Good morning, Jordan')).not.toBeInTheDocument();
    expect(screen.queryByText("Today's appointments")).not.toBeInTheDocument();
  });
});
