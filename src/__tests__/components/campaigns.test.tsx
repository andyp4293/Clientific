/**
 * Component tests for the Campaigns (Deals) page.
 * Covers rendering, stats visibility, and notify button display logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test Business' } }, status: 'authenticated' }),
}));

const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
    discountType: 'percent_off',
    discountValue: 20,
    serviceId: null,
    service: null,
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
    redemptions: [],
    ...overrides,
  };
}

// useQuery is called twice (deals + services); return deals first, services second
function mockQueries(deals: unknown[] = [], services: unknown[] = []) {
  let callCount = 0;
  mockUseQuery.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return { data: { deals }, isLoading: false } as any;
    return { data: { services }, isLoading: false } as any;
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('DealsPage (Campaigns)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByText('Spring Special')).toBeInTheDocument();
    expect(screen.getByText('Happy Hour Deal')).toBeInTheDocument();
  });

  it('shows "Notify Customers" button for active deal with no notifiedAt', () => {
    mockQueries([makeDeal({ active: true, notifiedAt: null })]);
    render(<DealsPage />);
    expect(screen.getByRole('button', { name: /notify customers/i })).toBeInTheDocument();
  });

  it('hides "Notify Customers" button when deal was notified within the last 7 days', () => {
    const recentlyNotified = new Date(Date.now() - 1 * 86400000).toISOString(); // 1 day ago
    mockQueries([makeDeal({ active: true, notifiedAt: recentlyNotified })]);
    render(<DealsPage />);
    expect(screen.queryByRole('button', { name: /notify customers/i })).not.toBeInTheDocument();
  });

  it('shows "Notify Customers" button when notifiedAt is older than 7 days', () => {
    const oldNotified = new Date(Date.now() - 8 * 86400000).toISOString(); // 8 days ago
    mockQueries([makeDeal({ active: true, notifiedAt: oldNotified })]);
    render(<DealsPage />);
    expect(screen.getByRole('button', { name: /notify customers/i })).toBeInTheDocument();
  });

  it('hides "Notify Customers" button for inactive deal', () => {
    mockQueries([makeDeal({ active: false, notifiedAt: null })]);
    render(<DealsPage />);
    expect(screen.queryByRole('button', { name: /notify customers/i })).not.toBeInTheDocument();
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
});
