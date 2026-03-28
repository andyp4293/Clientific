// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewSurveyExperience from './ReviewSurveyExperience';

const mockUseSearchParams = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

describe('ReviewSurveyExperience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=survey-token'));
  });

  it('routes 5-star customers to a public review CTA', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          business: {
            name: 'Davi Nails',
            slug: 'davi-nails',
            logoUrl: null,
            googleReviewUrl: 'https://google.com/review',
            yelpUrl: null,
            preferredReviewUrl: 'https://google.com/review',
            preferredReviewLabel: 'Google',
          },
          customer: {
            id: 'cust-1',
            name: 'Andy Pham',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          preferredReviewUrl: 'https://google.com/review',
          preferredReviewLabel: 'Google',
        }),
      }) as typeof fetch;

    render(<ReviewSurveyExperience slug="davi-nails" />);

    expect(await screen.findByText(/andy, how was your visit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /amazing/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to review/i }));

    expect(await screen.findByRole('link', { name: /leave a google/i })).toHaveAttribute(
      'href',
      'https://google.com/review'
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps lower ratings private and accepts feedback', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          business: {
            name: 'Davi Nails',
            slug: 'davi-nails',
            logoUrl: null,
            googleReviewUrl: 'https://google.com/review',
            yelpUrl: null,
            preferredReviewUrl: 'https://google.com/review',
            preferredReviewLabel: 'Google',
          },
          customer: {
            id: 'cust-1',
            name: 'Andy Pham',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          preferredReviewUrl: 'https://google.com/review',
          preferredReviewLabel: 'Google',
        }),
      }) as typeof fetch;

    render(<ReviewSurveyExperience slug="davi-nails" />);

    expect(await screen.findByText(/andy, how was your visit/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /good/i }));
    fireEvent.change(screen.getByLabelText(/private feedback/i), {
      target: { value: 'The wait ran longer than expected.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send private feedback/i }));

    expect(await screen.findByText(/your feedback was sent privately/i)).toBeInTheDocument();
    expect(screen.getByText(/goes straight to the business/i)).toBeInTheDocument();
  });
});
