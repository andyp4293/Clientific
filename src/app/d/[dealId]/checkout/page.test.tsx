// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DealCheckoutPage from './page';

// ── Core mocks ────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockRouterPush = vi.fn();
const mockConfirmPayment = vi.fn();
const mockElementsSubmit = vi.fn();

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
  useElements: () => ({ submit: mockElementsSubmit }),
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
    newCustomersOnly: false,
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
    mockElementsSubmit.mockResolvedValue({ error: undefined });

    // PI creation always succeeds by default
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ clientSecret: 'pi_test_secret', purchaseToken: 'tok_abc' }),
    } as Response);
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders contact fields, payment element, and order summary together', () => {
    render(<DealCheckoutPage />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile phone/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^payment$/i })).toBeInTheDocument();
    // Stripe element is visible immediately — no contact required first
    expect(screen.getByTestId('stripe-elements')).toBeInTheDocument();
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  });

  it('renders the order summary with selected service', () => {
    render(<DealCheckoutPage />);

    expect(screen.getAllByText('Summer Promo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Test Salon').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20% off/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Haircut')).toBeInTheDocument();
    expect(screen.getAllByText('$50.00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows secure checkout header', () => {
    render(<DealCheckoutPage />);
    expect(screen.getByText('Clientific')).toBeInTheDocument();
    expect(screen.getByText(/secure checkout/i)).toBeInTheDocument();
  });

  it('marks name, email, and phone as required fields', () => {
    render(<DealCheckoutPage />);
    // All three required indicators present
    const labels = screen.getAllByText('*');
    expect(labels.length).toBeGreaterThanOrEqual(3);
  });

  // ── Pay button gating ──────────────────────────────────────────────────────

  it('Pay button is disabled until all contact fields are valid', () => {
    render(<DealCheckoutPage />);
    const btn = screen.getByRole('button', { name: /pay/i });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane' } });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@example.com' } });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/mobile phone/i), { target: { value: '(555) 123-4567' } });
    expect(btn).not.toBeDisabled();
  });

  it('Pay button is disabled for invalid email', () => {
    render(<DealCheckoutPage />);
    fillContactForm('Jane', 'not-an-email', '5551234567');
    expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled();
  });

  it('Pay button is disabled for phone with fewer than 10 digits', () => {
    render(<DealCheckoutPage />);
    fillContactForm('Jane', 'jane@example.com', '555');
    expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled();
  });

  it('does not call payment-intent API before Pay is clicked', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    // Even after form is complete, fetch is not called until Pay is clicked
    await Promise.resolve();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ── Payment flow ───────────────────────────────────────────────────────────

  it('calls elements.submit then payment-intent API when Pay is clicked', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    await waitFor(() => {
      expect(mockElementsSubmit).toHaveBeenCalledOnce();
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

  it('redirects to receipt page after successful payment', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    await waitFor(() => {
      expect(mockConfirmPayment).toHaveBeenCalledOnce();
      expect(mockRouterPush).toHaveBeenCalledWith('/deal-purchases/tok_abc');
    });
  });

  it('confirmPayment is called with clientSecret and correct return_url', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    await waitFor(() => {
      expect(mockConfirmPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          clientSecret: 'pi_test_secret',
          confirmParams: expect.objectContaining({
            return_url: expect.stringContaining('/deal-purchases/tok_abc'),
          }),
          redirect: 'if_required',
        })
      );
    });
  });

  // ── Payment errors ─────────────────────────────────────────────────────────

  it('shows payment error inline when card is declined', async () => {
    mockConfirmPayment.mockResolvedValue({ error: { message: 'Your card was declined.' } });

    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    expect(await screen.findByText(/your card was declined/i)).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
  });

  it('shows error when elements.submit validation fails', async () => {
    mockElementsSubmit.mockResolvedValue({ error: { message: 'Card number is incomplete.' } });

    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    expect(await screen.findByText(/card number is incomplete/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows load error inline when payment-intent endpoint fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Deal is sold out' }),
    } as Response);

    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    expect(await screen.findByText(/deal is sold out/i)).toBeInTheDocument();
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });

  // ── Free deal ─────────────────────────────────────────────────────────────

  it('redirects immediately for a free deal without calling confirmPayment', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ immediate: true, url: '/deal-purchases/tok_free' }),
    } as Response);

    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/deal-purchases/tok_free');
    });
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });

  // ── SMS idempotency ────────────────────────────────────────────────────────

  it('payment-intent API is called exactly once per checkout', async () => {
    render(<DealCheckoutPage />);
    fillContactForm();
    fireEvent.click(screen.getByRole('button', { name: /pay/i }));

    await waitFor(() => expect(mockRouterPush).toHaveBeenCalled());
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

  it('shows the new-customer-only eligibility note on checkout', () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        deal: {
          ...baseDeal.deal,
          newCustomersOnly: true,
        },
      },
    });

    render(<DealCheckoutPage />);

    expect(screen.getAllByText(/new customers only/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/this phone number must not already exist in the business customer database/i)
    ).toBeInTheDocument();
  });
});
