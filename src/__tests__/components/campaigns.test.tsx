/**
 * Component tests for the Campaigns (Deals) page.
 * Covers rendering, stats visibility, and notify button display logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test Business' } }, status: 'authenticated' }),
}));

const mockInvalidateQueries = vi.fn();
const mockMutationMutate = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: mockMutationMutate, isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => <div data-testid="qr-code" />,
}));

vi.mock('@/components/ui/DatePicker', () => ({
  DatePicker: ({
    value,
    onChange,
    minDate,
    placeholder,
  }: {
    value: Date | null;
    onChange: (date: Date) => void;
    minDate?: Date;
    placeholder?: string;
  }) => {
    const toInputValue = (date: Date | null | undefined) => {
      if (!date) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return (
      <input
        data-testid={placeholder}
        type="date"
        value={toInputValue(value)}
        min={minDate ? toInputValue(minDate) : undefined}
        onChange={(event) => onChange(new Date(`${event.target.value}T00:00:00`))}
      />
    );
  },
}));

import { useQuery } from '@tanstack/react-query';
import DealsPage from '@/app/(dashboard)/dashboard/campaigns/page';

const mockUseQuery = vi.mocked(useQuery);

function makeDeal(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 86400000).toISOString();
  return {
    id: `deal-${Math.random()}`,
    title: 'Test Deal',
    description: null,
    deliveryType: 'purchase_link',
    serviceScope: 'all_services',
    discountType: 'percent_off',
    discountValue: 20,
    serviceId: null,
    service: null,
    eligibleServices: [],
    startsAt: now.toISOString(),
    expiresAt: future,
    maxRedemptions: null,
    redemptionCount: 0,
    active: true,
    createdAt: now.toISOString(),
    notifiedAt: null,
    platformFeePercent: 15,
    revenueTracked: 0,
    platformFeesOwed: 0,
    purchases: [],
    redemptions: [],
    notificationSends: [],
    ...overrides,
  };
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// useQuery is called three times (deals + services + business)
function mockQueries(
  deals: unknown[] = [],
  services: unknown[] = [],
  business: unknown = { name: 'Test Salon', publicId: 'pub_123' }
) {
  mockUseQuery.mockImplementation((config: any) => {
    const queryKey = config?.queryKey?.[0];
    if (queryKey === 'deals') return { data: { deals }, isLoading: false } as any;
    if (queryKey === 'services') return { data: { services }, isLoading: false } as any;
    if (queryKey === 'business') return { data: { business }, isLoading: false } as any;
    return { data: undefined, isLoading: false } as any;
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DealsPage (Campaigns)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationMutate.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it('uses the full shared dashboard page width instead of a narrow local container', () => {
    mockQueries([makeDeal()]);
    render(<DealsPage />);

    const page = screen.getByTestId('deals-page');
    expect(page).toHaveClass('w-full');
    expect(page.className).not.toContain('max-w-7xl');
  });

  it('renders without crash while loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any);
    expect(() => render(<DealsPage />)).not.toThrow();
  });

  it('renders without crash when deals is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false } as any);
    expect(() => render(<DealsPage />)).not.toThrow();
  });

  it('shows deal title cards when data is present', () => {
    mockQueries([makeDeal({ title: 'Spring Special' }), makeDeal({ title: 'Happy Hour Deal' })]);
    render(<DealsPage />);
    expect(screen.getAllByText('Spring Special').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Happy Hour Deal').length).toBeGreaterThan(0);
  });

  it('shows "Text My Customers" button for active deal with no notifiedAt', () => {
    mockQueries([makeDeal({ active: true, notifiedAt: null })]);
    render(<DealsPage />);
    expect(screen.getByRole('button', { name: /text my customers/i })).toBeInTheDocument();
  });

  it('keeps "Text My Customers" available even when the deal was notified recently', () => {
    const recentlyNotified = new Date(Date.now() - 1 * 86400000).toISOString();
    mockQueries([makeDeal({ active: true, notifiedAt: recentlyNotified })]);
    render(<DealsPage />);
    const button = screen.getByRole('button', { name: /text my customers/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(screen.queryByText(/cooldown:/i)).not.toBeInTheDocument();
  });

  it('hides "Text My Customers" button for inactive deal', () => {
    mockQueries([makeDeal({ active: false, notifiedAt: null })]);
    render(<DealsPage />);
    expect(screen.queryByRole('button', { name: /text my customers/i })).not.toBeInTheDocument();
  });

  it('shows revenue stats when revenueTracked > 0', () => {
    mockQueries([makeDeal({ revenueTracked: 150.5, platformFeesOwed: 22.58 })]);
    render(<DealsPage />);
    expect(screen.getByText(/\$150\.50/)).toBeInTheDocument();
    expect(screen.getByText(/\$22\.58/)).toBeInTheDocument();
  });

  it('hides revenue stats when revenueTracked is 0', () => {
    mockQueries([makeDeal({ revenueTracked: 0, platformFeesOwed: 0 })]);
    render(<DealsPage />);
    expect(screen.queryByText(/revenue tracked/i)).not.toBeInTheDocument();
  });

  it('shows "No deals yet" when deals array is empty', () => {
    mockQueries([]);
    render(<DealsPage />);
    expect(screen.getByText(/no deals yet/i)).toBeInTheDocument();
  });

  it('opens the new deal form in a modal so the form stays in view', () => {
    mockQueries([]);
    render(<DealsPage />);

    expect(
      screen.queryByRole('dialog', { name: /create a new promotion/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /new deal/i }));

    expect(
      screen.getByRole('dialog', { name: /create a new promotion/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close new deal modal/i }));

    expect(
      screen.queryByRole('dialog', { name: /create a new promotion/i })
    ).not.toBeInTheDocument();
  });

  it('limits deal dates to today or later and keeps the end date after the start date', () => {
    mockQueries([]);
    render(<DealsPage />);

    fireEvent.click(screen.getByRole('button', { name: /new deal/i }));

    const startInput = screen.getByTestId('Select start date') as HTMLInputElement;
    const endInput = screen.getByTestId('Select end date') as HTMLInputElement;
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    expect(startInput.min).toBe(formatDateInputValue(today));
    expect(startInput.value).toBe(formatDateInputValue(today));
    expect(endInput.min).toBe(formatDateInputValue(tomorrow));
    expect(endInput.value).toBe(formatDateInputValue(tomorrow));

    fireEvent.change(startInput, { target: { value: '2026-04-10' } });

    expect(endInput.min).toBe('2026-04-11');
    expect(endInput.value).toBe('2026-04-11');
  });

  it('updates the in-store capture link when a deal is selected', () => {
    mockQueries([makeDeal({ id: 'deal-1', title: 'Spring Special' })]);
    render(<DealsPage />);

    const linkInput = screen.getByLabelText(/device link/i) as HTMLInputElement;
    expect(linkInput.value).toBe('http://localhost:3000/capture/pub_123');

    // CustomSelect uses a button trigger — click to open, then click the listbox option
    fireEvent.click(screen.getByLabelText(/promo shown on device/i));
    fireEvent.click(screen.getByRole('option', { name: 'Spring Special' }));

    expect(linkInput.value).toBe('http://localhost:3000/capture/pub_123?deal=deal-1');
  });

  it('shows Sending only on the clicked deal while disabling the other deal send buttons', () => {
    mockQueries([
      makeDeal({ id: 'deal-1', title: 'Spring Special' }),
      makeDeal({ id: 'deal-2', title: 'Happy Hour Deal' }),
    ]);

    render(<DealsPage />);

    const sendButtons = screen.getAllByRole('button', { name: /text my customers/i });
    expect(sendButtons).toHaveLength(2);

    fireEvent.click(sendButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /yes, send/i }));

    const notifyButtonsAfterConfirm = screen.getAllByRole('button', { name: /text my customers|sending/i });
    expect(mockMutationMutate).toHaveBeenCalledWith('deal-1');
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    expect(screen.queryAllByRole('button', { name: /sending/i })).toHaveLength(1);
    expect(notifyButtonsAfterConfirm.find((button) => button.textContent?.trim() === 'Text My Customers')).toBeDisabled();
  });

  it('shows sent recipients inside the expanded activity view', () => {
    mockQueries([
      makeDeal({
        notificationSends: [
          {
            id: 'send-1',
            createdAt: '2026-03-14T18:15:00.000Z',
            customerId: 'cust-1',
            customerName: 'Jane Doe',
            customerPhone: '+15551111111',
            code: 'JANE1234',
            purchaseUrl: null,
            deliveryType: 'purchase_link',
            status: 'sent',
            errorMessage: null,
          },
        ],
      }),
    ]);

    render(<DealsPage />);

    fireEvent.click(screen.getByRole('button', { name: /view activity/i }));

    expect(screen.getByText(/sent recipients/i)).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('(555) 111-1111')).toBeInTheDocument();
    expect(screen.getByText('JANE1234')).toBeInTheDocument();
  });
});
