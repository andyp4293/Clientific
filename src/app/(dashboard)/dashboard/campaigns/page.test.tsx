// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: unknown) => mockUseQuery(config),
  useMutation: (config: unknown) => mockUseMutation(config),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => <div data-testid="qr-code" />,
}));

vi.mock('@/components/campaigns/InStoreCapturePanel', () => ({
  default: () => <div data-testid="in-store-capture-panel" />,
}));

vi.mock('@/components/ui/DatePicker', () => ({
  DatePicker: () => <div data-testid="date-picker" />,
}));

vi.mock('@/components/ui/CustomSelect', () => ({
  CustomSelect: () => <div data-testid="custom-select" />,
}));

import DealsPage from './page';

describe('DealsPage', () => {
  it('uses the full desktop page shell', () => {
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    });

    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    mockUseQuery.mockImplementation((config: { queryKey?: string[] }) => {
      const key = config?.queryKey?.[0];

      if (key === 'deals') {
        return {
          data: {
            deals: [],
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

      if (key === 'business') {
        return {
          data: {
            business: {
              name: 'ABC Nails',
              publicId: 'public_123',
            },
          },
          isLoading: false,
        };
      }

      if (key === 'connect-account') {
        return {
          data: {
            readyForPaidDeals: true,
            notConnected: false,
          },
          isLoading: false,
        };
      }

      return { data: undefined, isLoading: false };
    });

    render(<DealsPage />);

    const page = screen.getByTestId('deals-page');
    expect(page).toHaveClass('w-full');
    expect(page).not.toHaveClass('max-w-7xl');
  });
});
