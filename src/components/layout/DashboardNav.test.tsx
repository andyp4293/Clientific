// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { DashboardNav } from './DashboardNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/settings',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        name: 'Test Nail Salon',
        email: 'andyp4293@gmail.com',
      },
    },
    status: 'authenticated',
  }),
  signOut: vi.fn(),
}));

describe('DashboardNav', () => {
  it('shows the live business name and logo instead of stale session profile text', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardNav
          initialBusiness={{
            name: 'ABC Nails',
            email: 'contact@abcnails.com',
            logoUrl: 'https://example.com/logo.png',
          }}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('ABC Nails')).toBeInTheDocument();
    expect(screen.queryByText('Test Nail Salon')).not.toBeInTheDocument();

    const logo = screen.getByAltText('ABC Nails logo') as HTMLImageElement;
    expect(logo).toBeInTheDocument();
    expect(logo.src).toContain('https://example.com/logo.png');
    expect(screen.getByText('contact@abcnails.com')).toBeInTheDocument();
  });
});
