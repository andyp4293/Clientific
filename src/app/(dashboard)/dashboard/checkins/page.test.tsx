// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: unknown) => mockUseQuery(config),
  useMutation: (config: unknown) => mockUseMutation(config),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/DatePicker', () => ({
  DatePicker: () => <div data-testid="date-picker" />,
}));

vi.mock('@/components/ui/CustomSelect', () => ({
  CustomSelect: () => <div data-testid="custom-select" />,
}));

vi.mock('@/components/checkins/InStoreCheckInPanel', () => ({
  default: ({ business }: { business: { publicId: string; name: string } | null }) => (
    <div data-testid="in-store-checkin-panel">
      {business ? `${business.name}:${business.publicId}` : 'no-business'}
    </div>
  ),
}));

import CheckInsPage from './page';

function mockMutations(createMutation: Record<string, unknown>, lookupMutation: Record<string, unknown>) {
  let callCount = 0;
  mockUseMutation.mockImplementation(() => {
    callCount += 1;
    return callCount % 2 === 1 ? createMutation : lookupMutation;
  });
}

function setupQueries() {
  mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
    const key = config?.queryKey?.[0];

    if (key === 'checkins') {
      return {
        data: {
          checkIns: [],
          timezone: 'America/New_York',
        },
        isLoading: false,
      };
    }

    if (key === 'customers') {
      return {
        data: {
          customers: [],
        },
        isLoading: false,
      };
    }

    if (key === 'services') {
      return {
        data: {
          services: [],
        },
        isLoading: false,
      };
    }

    if (key === 'business-info') {
      return {
        data: {
          business: {
            name: 'Test Salon',
            publicId: 'pub_123',
          },
        },
        isLoading: false,
      };
    }

    if (key === 'staff') {
      return {
        data: {
          staff: [],
        },
        isLoading: false,
      };
    }

    return { data: undefined, isLoading: false };
  });
}

function pressDigits(digits: string) {
  for (const digit of digits) {
    fireEvent.click(screen.getAllByRole('button', { name: digit })[0]);
  }
}

describe('CheckInsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    });
    setupQueries();
  });

  it('uses the full desktop page shell', () => {
    mockMutations(
      { mutateAsync: vi.fn(), isPending: false, isError: false },
      { mutateAsync: vi.fn(), isPending: false }
    );

    render(<CheckInsPage />);

    const page = screen.getByTestId('checkins-page');
    expect(page).toHaveClass('w-full');
    expect(page).not.toHaveClass('max-w-7xl');
  });

  it('removes revenue language from the dashboard and shows the in-store check-in link panel', () => {
    mockMutations(
      { mutateAsync: vi.fn(), isPending: false, isError: false },
      { mutateAsync: vi.fn(), isPending: false }
    );

    render(<CheckInsPage />);

    expect(screen.queryByText('Revenue tracked')).not.toBeInTheDocument();
    expect(screen.queryByText('Average ticket')).not.toBeInTheDocument();
    expect(screen.queryByText(/walk-in revenue/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Three beats from arrival to done')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Check-ins$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Default behavior')).not.toBeInTheDocument();
    expect(screen.getByText('Check ins')).toBeInTheDocument();
    expect(screen.getByTestId('in-store-checkin-panel')).toHaveTextContent('Test Salon:pub_123');
  });

  it('opens the quick check-in overlay with the built-in keypad', () => {
    mockMutations(
      { mutateAsync: vi.fn(), isPending: false, isError: false },
      { mutateAsync: vi.fn(), isPending: false }
    );

    render(<CheckInsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick check-in' }));

    const overlay = document.querySelector('[data-mobile-overlay="true"]');
    expect(overlay).not.toBeNull();
    expect(screen.getByText('Check in customer')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer phone number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('(___) ___-____')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('(555) 123-4567')).not.toBeInTheDocument();
    expect(screen.queryByText('Phone first. Everything else second.')).not.toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^(?:[0-9]|Clear|Delete)$/ })).toHaveLength(12);
    expect(screen.queryByText('What happens')).not.toBeInTheDocument();
    expect(screen.queryByText('Guests today')).not.toBeInTheDocument();
  }, 15000);

  it('lets the front desk type the number directly from the keyboard field', () => {
    mockMutations(
      { mutateAsync: vi.fn(), isPending: false, isError: false },
      { mutateAsync: vi.fn(), isPending: false }
    );

    render(<CheckInsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick check-in' }));

    const input = screen.getByLabelText('Customer phone number');
    fireEvent.change(input, { target: { value: '8482612613' } });

    expect(input).toHaveValue('(848) 261-2613');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('moves a brand new number into the customer-details step', async () => {
    const createMutation = { mutateAsync: vi.fn(), isPending: false, isError: false };
    const lookupMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        status: 'new',
        normalizedPhone: '8482612613',
        displayPhone: '(848) 261-2613',
      }),
      isPending: false,
    };

    mockMutations(createMutation, lookupMutation);

    render(<CheckInsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick check-in' }));
    pressDigits('8482612613');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Add the customer name')).toBeInTheDocument();
    });

    expect(lookupMutation.mutateAsync).toHaveBeenCalledWith('8482612613');
  }, 15000);

  it('shows a validation message and does not call lookup for an incomplete number', async () => {
    const createMutation = { mutateAsync: vi.fn(), isPending: false, isError: false };
    const lookupMutation = {
      mutateAsync: vi.fn(),
      isPending: false,
    };

    mockMutations(createMutation, lookupMutation);

    render(<CheckInsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick check-in' }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(lookupMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('shows a selector when multiple customers share the same normalized phone number', async () => {
    const createMutation = { mutateAsync: vi.fn(), isPending: false, isError: false };
    const lookupMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        status: 'multiple',
        customers: [
          { id: 'cust-1', name: 'Andy', phone: '8482612613', email: null, lastVisit: '2026-03-20T16:00:00.000Z' },
          { id: 'cust-2', name: 'Andy 2', phone: '8482612613', email: 'alt@example.com', lastVisit: null },
        ],
      }),
      isPending: false,
    };

    mockMutations(createMutation, lookupMutation);

    render(<CheckInsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick check-in' }));
    pressDigits('8482612613');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Pick the right customer')).toBeInTheDocument();
    });

    expect(screen.getByText('Andy 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'None of these customers' })).toBeInTheDocument();
  }, 15000);

  it('checks in an existing customer immediately after a normalized phone match', async () => {
    const createMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        checkIn: { checkInTime: '2026-03-22T14:30:00.000Z' },
      }),
      isPending: false,
      isError: false,
    };
    const lookupMutation = {
      mutateAsync: vi.fn().mockResolvedValue({
        status: 'existing',
        customer: {
          id: 'cust-1',
          name: 'Andy',
          phone: '8482612613',
          email: null,
        },
      }),
      isPending: false,
    };

    mockMutations(createMutation, lookupMutation);

    render(<CheckInsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick check-in' }));
    pressDigits('8482612613');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Check-in complete')).toBeInTheDocument();
    });

    expect(createMutation.mutateAsync).toHaveBeenCalledWith({
      customerId: 'cust-1',
      phone: '8482612613',
    });
  }, 15000);

  it('lets the front desk switch into the detailed entry flow', () => {
    mockMutations(
      { mutateAsync: vi.fn(), isPending: false, isError: false },
      { mutateAsync: vi.fn(), isPending: false }
    );

    render(<CheckInsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Detailed entry' }));

    expect(screen.getByText('Add service or staff when needed')).toBeInTheDocument();
    expect(screen.getAllByTestId('custom-select')).toHaveLength(2);
    expect(screen.queryByText('Capture detail only when it matters.')).not.toBeInTheDocument();
    expect(screen.queryByText('Amount spent (optional)')).not.toBeInTheDocument();
  });
});
