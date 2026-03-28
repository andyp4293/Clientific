// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewsPage from './page';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'business') {
      return {
        data: {
          name: 'Davi Nails',
          slug: 'davi-nails',
          googleReviewUrl: null,
          yelpUrl: null,
        },
      };
    }

    return { data: { logs: [] }, isLoading: false };
  }),
}));

describe('ReviewsPage', () => {
  it('links empty review setup directly to Social & Reviews settings', () => {
    render(<ReviewsPage />);

    const link = screen.getByRole('link', { name: /add a public review link in social & reviews/i });
    expect(link).toHaveAttribute('href', '/dashboard/settings?tab=integrations');
  });

  it('shows the public survey link on the reviews page', () => {
    render(<ReviewsPage />);

    const surveyLink = screen.getByRole('link', { name: '/feedback/davi-nails' });
    expect(surveyLink).toHaveAttribute('href', '/feedback/davi-nails');
  });
});
