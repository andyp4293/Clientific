// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicDealClaimPage from './page';

const mockUseQuery = vi.fn();
const mockUseSearchParams = vi.fn(() => new URLSearchParams());
const mockRouterPush = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ dealId: 'deal-1' }),
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock('@/components/layout/PublicSiteHeader', () => ({
  PublicSiteHeader: () => <div data-testid="public-site-header" />,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCodeClaimDeal(viewerCanManage = false) {
  return {
    deal: {
      id: 'deal-1',
      title: 'Spring Special',
      description: 'Save on your next visit',
      deliveryType: 'code_claim',
      serviceScope: 'selected_services',
      discountType: 'percent_off',
      discountValue: 20,
      startsAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-31T00:00:00.000Z',
      service: { name: 'Haircut' },
      selectableServices: [],
      business: { name: 'Test Salon', slug: 'test-salon', publicId: 'pub-1', city: 'Austin', state: 'TX' },
      viewerCanManage,
    },
  };
}

function makePurchaseLinkDeal() {
  return {
    deal: {
      id: 'deal-1',
      title: 'Summer Promo',
      description: '20% off any service',
      deliveryType: 'purchase_link',
      serviceScope: 'all_services',
      discountType: 'percent_off',
      discountValue: 20,
      startsAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-04-30T00:00:00.000Z',
      service: null,
      selectableServices: [
        { id: 'svc-1', name: 'Haircut', price: 50, duration: 45 },
        { id: 'svc-2', name: 'Color', price: 120, duration: 90 },
      ],
      business: { name: 'Test Salon', slug: 'test-salon', publicId: 'pub-1', city: 'Austin', state: 'TX' },
      viewerCanManage: false,
    },
  };
}

// ── Legacy code_claim tests ───────────────────────────────────────────────────

describe('PublicDealClaimPage — code_claim flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockUseQuery.mockReturnValue({ isLoading: false, isError: false, data: makeCodeClaimDeal() });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABCD1234', confirmationSent: true }),
    } as Response);
  });

  it('requires both name and phone before allowing the claim', () => {
    render(<PublicDealClaimPage />);
    expect(screen.getByRole('button', { name: /claim deal code/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    expect(screen.getByRole('button', { name: /claim deal code/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    expect(screen.getByRole('button', { name: /claim deal code/i })).not.toBeDisabled();
  });

  it('posts name and phone to the claim endpoint and shows the returned code', async () => {
    render(<PublicDealClaimPage />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /claim deal code/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/deals/deal-1/claim',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ customerName: 'Jane Doe', customerPhone: '(555) 123-4567' }) })
      );
    });

    expect(await screen.findByText('ABCD1234')).toBeInTheDocument();
    expect(screen.getByText(/we also texted this code/i)).toBeInTheDocument();
  });

  it('shows a back link to the deals dashboard for the owning business', () => {
    mockUseQuery.mockReturnValue({ isLoading: false, isError: false, data: makeCodeClaimDeal(true) });
    render(<PublicDealClaimPage />);
    expect(screen.getByRole('link', { name: /back to deals/i })).toHaveAttribute('href', '/dashboard/campaigns');
  });
});

// ── Purchase link flow tests ──────────────────────────────────────────────────

describe('PublicDealClaimPage — purchase_link flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockUseQuery.mockReturnValue({ isLoading: false, isError: false, data: makePurchaseLinkDeal() });
  });

  it('renders selectable services', () => {
    render(<PublicDealClaimPage />);
    expect(screen.getByText('Haircut')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
  });

  it('disables Continue to Checkout until at least one service is selected', () => {
    render(<PublicDealClaimPage />);
    expect(screen.getByRole('button', { name: /continue to checkout/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /haircut/i }));
    expect(screen.getByRole('button', { name: /continue to checkout/i })).not.toBeDisabled();
  });

  it('navigates to checkout page with selected service IDs on Continue', () => {
    render(<PublicDealClaimPage />);
    fireEvent.click(screen.getByRole('button', { name: /haircut/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to checkout/i }));

    expect(mockRouterPush).toHaveBeenCalledWith('/d/deal-1/checkout?services=svc-1');
  });

  it('passes multiple selected service IDs to checkout URL', () => {
    render(<PublicDealClaimPage />);
    fireEvent.click(screen.getByRole('button', { name: /haircut/i }));
    fireEvent.click(screen.getByRole('button', { name: /color/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to checkout/i }));

    expect(mockRouterPush).toHaveBeenCalledWith('/d/deal-1/checkout?services=svc-1%2Csvc-2');
  });

  it('shows order summary with selected service price and discounted total', () => {
    render(<PublicDealClaimPage />);
    fireEvent.click(screen.getByRole('button', { name: /haircut/i }));

    // Haircut $50, 20% off = $40
    expect(screen.getAllByText('$50.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$40.00').length).toBeGreaterThan(0);
  });

  it('toggles service selection on repeated clicks', () => {
    render(<PublicDealClaimPage />);
    fireEvent.click(screen.getByRole('button', { name: /haircut/i }));
    expect(screen.getByRole('button', { name: /continue to checkout/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /haircut/i }));
    expect(screen.getByRole('button', { name: /continue to checkout/i })).toBeDisabled();
  });
});
