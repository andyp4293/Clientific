// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DealCheckoutPage from './page';

// ── Core mocks ────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockRouterPush = vi.fn();
const mockConfirmPayment = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ dealId: 'deal-1' }),
  useSearchParams: () => new URLSearchParams('services=svc-1'),
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseDeal = {
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
    selectableServices: [
      { id: 'svc-1', name: 'Haircut', price: 50, duration: 45 },
      { id: 'svc-2', name: 'Color', price: 120, duration: 90 },
    ],
    business: {
      name: 'Test Salon',
      slug: 'test-salon',
      publicId: 'pub-1',
      city: 'Austin',
      state: 'TX',
    },
  },
};

function fillContactForm(name = 'Jane Doe', email = 'jane@example.com', phone = '(555) 123-4567') {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: phone } });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DealCheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseDeal,
    });

    // Payment always succeeds by default
    mockConfirmPayment.mockResolvedValue({ error: undefined });

    // PI creation always succeeds by default
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: 'pi_test_secret', purchaseToken: 'tok_abc' }),
    } as Response);
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders contact fields and payment section on the same page', () => {
    render(<DealCheckoutPage />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile phone/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^payment$/i })).toBeInTheDocument();
  });

  it('renders the order summary with selected service', () => {
    render(<DealCheckoutPage />);

    expect(screen.getByText('Summer Promo')).toBeInTheDocument();
    expect(screen.getByText('Test Salon')).toBeInTheDocument();
    expect(screen.getAllByText(/20% off/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Haircut')).toBeInTheDocument();
    // $50 appears in service row AND subtotal row
    expect(screen.getAllByText('$50.00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows secure checkout header with logo and lock icon text', () => {
    render(<DealCheckoutPage />);
    expect(screen.getByText('Clientific')).toBeInTheDocument();
    expect(screen.getByText(/secure checkout/i)).toBeInTheDocument();
  });

  // ── Contact form validation ────────────────────────────────────────────────

  it('disables Continue to Payment until all contact fields are filled', () => {
    render(<DealCheckoutPage />);
    const btn = screen.getByRole('button', { name: /continue to payment/i });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@example.com' } });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    expect(btn).not.toBeDisabled();
  });

  it('disables Continue to Payment for an invalid email', () => {
    render(<DealCheckoutPage />);
    fillContactForm('Jane', 'not-an-email', '5551234567');
    expect(screen.getByRole('button', { name: /continue to payment/i })).toBeDisabled();
  });

  it('requires at least 10 digits for phone', () => {
    render(<DealCheckoutPage />);
    fillContactForm('Jane', 'jane@example.com', '555');
    expect(screen.getByRole('button', { name: /continue to payment/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '5551234567' } });
    expect(screen.getByRole('button', { name: /continue to payment/i })).not.toBeDisabled();
  });

  // ── Loading payment ────────────────────────────────────────────────────────

  it('calls payment-intent API with all contact fields when Continue is clicked', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/deals/deal-1/payment-intent',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            customerName: 'Jane Doe',
            customerEmail: 'jane@example.com',
            customerPhone: '(555) 123-4567',
            selectedServiceIds: ['svc-1'],
          }),
        })
      );
    });
  });

  it('shows Stripe payment element AND contact info summary after Continue is clicked', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await screen.findByTestId('stripe-elements');

    // Payment element is visible
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();

    // Contact info is still visible as a read-only summary
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
  });

  it('shows contact fields and Pay button on the same page simultaneously', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await screen.findByTestId('stripe-elements');

    // Both are visible at the same time
    expect(screen.getByText('Contact information')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pay/i })).toBeInTheDocument();
  });

  it('Edit button returns contact form to editable state and clears payment element', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await screen.findByTestId('stripe-elements');

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  // ── Payment success ────────────────────────────────────────────────────────

  it('redirects to receipt page after successful payment', async () => {
    // Payment always succeeds
    mockConfirmPayment.mockResolvedValue({ error: undefined });

    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await screen.findByTestId('stripe-elements');
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    await waitFor(() => {
      expect(mockConfirmPayment).toHaveBeenCalledOnce();
      expect(mockRouterPush).toHaveBeenCalledWith('/deal-purchases/tok_abc');
    });
  });

  it('confirmPayment is called with the correct return_url', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await screen.findByTestId('stripe-elements');
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    await waitFor(() => {
      expect(mockConfirmPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmParams: expect.objectContaining({
            return_url: expect.stringContaining('/deal-purchases/tok_abc'),
          }),
          redirect: 'if_required',
        })
      );
    });
  });

  // ── Payment error ──────────────────────────────────────────────────────────

  it('shows payment error inline and stays on checkout page when payment fails', async () => {
    mockConfirmPayment.mockResolvedValue({ error: { message: 'Your card was declined.' } });

    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await screen.findByTestId('stripe-elements');
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    expect(await screen.findByText(/your card was declined/i)).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
    // Payment element stays visible after failure
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  });

  it('shows load error inline when payment-intent endpoint fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Deal is sold out' }),
    } as Response);

    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    expect(await screen.findByText(/deal is sold out/i)).toBeInTheDocument();
    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
  });

  // ── Free deal ─────────────────────────────────────────────────────────────

  it('redirects immediately for a free deal without showing Stripe elements', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ immediate: true, url: '/deal-purchases/tok_free' }),
    } as Response);

    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/deal-purchases/tok_free');
    });
    expect(screen.queryByTestId('stripe-elements')).not.toBeInTheDocument();
  });

  // ── SMS / message confirmation ─────────────────────────────────────────────

  it('payment-intent is called once per checkout (SMS will fire exactly once on success)', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await screen.findByTestId('stripe-elements');
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalled());

    // API was called exactly once — no duplicate PI creation that would cause duplicate SMS
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // ── Error/unavailable states ───────────────────────────────────────────────

  it('shows unavailable message for non-purchase_link deals', () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        deal: { ...baseDeal.deal, deliveryType: 'code_claim' },
      },
    });

    render(<DealCheckoutPage />);
    expect(screen.getByText(/deal unavailable|checkout unavailable/i)).toBeInTheDocument();
  });

  it('shows loading state while fetching deal', () => {
    mockUseQuery.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    render(<DealCheckoutPage />);
    expect(screen.getByText(/loading checkout/i)).toBeInTheDocument();
  });
});
