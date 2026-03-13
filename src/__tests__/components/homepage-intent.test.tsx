import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

    expect(await screen.findByText('Choose your path')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'I run a business' })).toHaveAttribute(
      'href',
      '/register'
    );
    expect(await screen.findByRole('link', { name: "I'm looking to book" })).toHaveAttribute(
      'href',
      '/explore'
    );
    },
    15000
  );

  it('routes authenticated business users to dashboard from the business path CTA', async () => {
    mockUseSession.mockReturnValue({ status: 'authenticated', data: { user: { id: 'biz-1' } } });
    render(<HomePage />);

    expect(await screen.findByRole('link', { name: 'I run a business' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });
});
