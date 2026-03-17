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

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

const mockConfirmPayment = vi.fn();
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
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

// ── Purchase link / Payment Element tests ─────────────────────────────────────

describe('PublicDealClaimPage — purchase_link flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockUseQuery.mockReturnValue({ isLoading: false, isError: false, data: makePurchaseLinkDeal() });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: 'pi_test_secret', purchaseToken: 'tok_abc', purchaseId: 'purchase-1' }),
    } as Response);
  });

  it('renders selectable services', () => {
    render(<PublicDealClaimPage />);
    expect(screen.getByText('Haircut')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
  });

  it('disables Buy now until a service, name, and phone are all provided', () => {
    render(<PublicDealClaimPage />);
    expect(screen.getByRole('button', { name: /buy now/i })).toBeDisabled();

    fireEvent.click(screen.getByText('Haircut'));
    expect(screen.getByRole('button', { name: /buy now/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    expect(screen.getByRole('button', { name: /buy now/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    expect(screen.getByRole('button', { name: /buy now/i })).not.toBeDisabled();
  });

  it('calls the payment-intent endpoint and shows the embedded PaymentElement on success', async () => {
    render(<PublicDealClaimPage />);

    fireEvent.click(screen.getByText('Haircut'));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /buy now/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/deals/deal-1/payment-intent',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ customerName: 'Jane Doe', customerPhone: '(555) 123-4567', selectedServiceIds: ['svc-1'] }),
        })
      );
    });

    expect(await screen.findByTestId('stripe-elements')).toBeInTheDocument();
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
  });

  it('shows the order summary in step 2 with the deal title and discounted total', async () => {
    render(<PublicDealClaimPage />);
    fireEvent.click(screen.getByText('Haircut'));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /buy now/i }));

    await screen.findByTestId('stripe-elements');
    // The compact order summary shows the deal title and discount label
    expect(screen.getAllByText('Summer Promo').length).toBeGreaterThan(0);
    expect(screen.getByText(/20% off applied/i)).toBeInTheDocument();
  });

  it('Go back button returns to step 1 form', async () => {
    render(<PublicDealClaimPage />);
    fireEvent.click(screen.getByText('Haircut'));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /buy now/i }));

    await screen.findByTestId('stripe-elements');
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));

    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy now/i })).toBeInTheDocument();
  });

  it('shows inline error and stays on step 1 when payment-intent endpoint fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Business not ready to accept payments' }),
    } as Response);

    render(<PublicDealClaimPage />);
    fireEvent.click(screen.getByText('Haircut'));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /buy now/i }));

    expect(await screen.findByText(/business not ready to accept payments/i)).toBeInTheDocument();
    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
  });

  it('routes to receipt directly for a free deal (immediate: true)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ immediate: true, url: '/deal-purchases/tok_free', purchaseId: 'purchase-free' }),
    } as Response);

    render(<PublicDealClaimPage />);
    fireEvent.click(screen.getByText('Haircut'));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    fireEvent.click(screen.getByRole('button', { name: /buy now/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/deal-purchases/tok_free');
    });
    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
  });

  it('shows canceled checkout notice when returning from Stripe with checkout=canceled', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('checkout=canceled'));
    render(<PublicDealClaimPage />);
    expect(screen.getByText(/checkout was canceled/i)).toBeInTheDocument();
  });
});
