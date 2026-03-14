// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicDealClaimPage from './page';

const mockUseQuery = vi.fn();

function makeDealData(viewerCanManage = false) {
  return {
    deal: {
      id: 'deal-1',
      title: 'Spring Special',
      description: 'Save on your next visit',
      discountType: 'percent_off',
      discountValue: 20,
      startsAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-31T00:00:00.000Z',
      service: { name: 'Haircut' },
      business: {
        name: 'Test Salon',
        slug: 'test-salon',
        publicId: 'pub-1',
        city: 'Austin',
        state: 'TX',
      },
      viewerCanManage,
    },
  };
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ dealId: 'deal-1' }),
}));

vi.mock('@/components/layout/PublicSiteHeader', () => ({
  PublicSiteHeader: () => <div data-testid="public-site-header" />,
}));

describe('PublicDealClaimPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeDealData(),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABCD1234', confirmationSent: true }),
    } as Response);
  });

  it('requires both name and phone before allowing the claim', () => {
    render(<PublicDealClaimPage />);

    expect(screen.queryByRole('link', { name: /back to deals/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim deal code/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: 'Jane Doe' },
    });
    expect(screen.getByRole('button', { name: /claim deal code/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/mobile phone/i), {
      target: { value: '(555) 123-4567' },
    });
    expect(screen.getByRole('button', { name: /claim deal code/i })).not.toBeDisabled();
  });

  it('posts the name and phone to the public claim endpoint and shows the returned code', async () => {
    render(<PublicDealClaimPage />);

    fireEvent.change(screen.getByLabelText(/your name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), {
      target: { value: '(555) 123-4567' },
    });
    fireEvent.click(screen.getByRole('button', { name: /claim deal code/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/deals/deal-1/claim',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'Jane Doe',
            customerPhone: '(555) 123-4567',
          }),
        })
      );
    });

    expect(await screen.findByText('ABCD1234')).toBeInTheDocument();
    expect(screen.getByText(/we also texted this code to your phone/i)).toBeInTheDocument();
  });

  it('shows a back link to the deals dashboard for the owning business', () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeDealData(true),
    });

    render(<PublicDealClaimPage />);

    expect(screen.getByRole('link', { name: /back to deals/i })).toHaveAttribute(
      'href',
      '/dashboard/campaigns'
    );
  });
});
