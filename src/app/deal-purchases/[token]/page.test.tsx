// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DealPurchaseReceiptPage from './page';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'tok_123' }),
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const basePurchase = {
  viewerCanManage: false,
  purchase: {
    id: 'purchase-1',
    token: 'tok_123',
    status: 'paid',
    customerName: 'Jane Doe',
    customerPhone: '(555) 123-4567',
    customerEmail: 'jane@example.com',
    subtotalAmount: 10000,
    discountAmount: 2000,
    totalAmount: 8000,
    applicationFeeAmount: 1200,
    businessNetAmount: 6800,
    stripeReceiptUrl: 'https://stripe.test/receipt',
    redemptionCode: 'SAVE20',
    purchasedAt: '2026-03-19T12:00:00.000Z',
    redeemedAt: null,
    expiresAt: '2026-04-30T00:00:00.000Z',
    deal: {
      id: 'deal-1',
      title: 'Spring Glow Package',
      description: 'A polished premium package.',
      discountType: 'percent_off',
      discountValue: 20,
    },
    business: {
      name: 'Test Salon',
      slug: 'test-salon',
      publicId: 'pub-1',
      city: 'Austin',
      state: 'TX',
    },
    items: [
      {
        id: 'item-1',
        serviceName: 'Haircut',
        quantity: 1,
        originalUnitAmount: 10000,
        discountedUnitAmount: 8000,
      },
    ],
  },
};

describe('DealPurchaseReceiptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: basePurchase,
      isLoading: false,
      isError: false,
    });
  });

  it('renders the premium receipt summary and actions', () => {
    render(<DealPurchaseReceiptPage />);

    expect(screen.getByText(/purchase confirmed/i)).toBeInTheDocument();
    expect(screen.getByText('Spring Glow Package')).toBeInTheDocument();
    expect(screen.getByText('SAVE20')).toBeInTheDocument();
    expect(screen.getByText(/receipt emailed to jane@example.com/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view business/i })).toHaveAttribute(
      'href',
      '/business/pub-1'
    );
    expect(screen.getByRole('link', { name: /find more deals nearby/i })).toHaveAttribute(
      'href',
      '/explore?location=Austin'
    );
  });

  it('shows dashboard back link when the viewer owns the business', () => {
    mockUseQuery.mockReturnValue({
      data: {
        ...basePurchase,
        viewerCanManage: true,
      },
      isLoading: false,
      isError: false,
    });

    render(<DealPurchaseReceiptPage />);

    expect(screen.getByRole('button', { name: /back to deals/i })).toBeInTheDocument();
  });

  it('shows a loading state while the receipt is being confirmed', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<DealPurchaseReceiptPage />);

    expect(screen.getByText(/confirming your purchase/i)).toBeInTheDocument();
  });

  it('shows a fallback state when the receipt cannot be loaded', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<DealPurchaseReceiptPage />);

    expect(screen.getByText(/receipt unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse active deals/i })).toHaveAttribute(
      'href',
      '/explore'
    );
  });

  it('hides the dashboard back link for non-owners', () => {
    render(<DealPurchaseReceiptPage />);

    expect(screen.queryByRole('button', { name: /back to deals/i })).not.toBeInTheDocument();
  });
});
