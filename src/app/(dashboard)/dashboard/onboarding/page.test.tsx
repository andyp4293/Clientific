// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DashboardOnboardingPage from './page';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockTimezoneFromCoordinates = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock('@/lib/timezone', () => ({
  timezoneFromCoordinates: (...args: unknown[]) => mockTimezoneFromCoordinates(...args),
}));

vi.mock('@/components/ui/AddressAutocomplete', () => ({
  __esModule: true,
  default: ({
    onAddressSelect,
  }: {
    onAddressSelect: (address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      latitude: number;
      longitude: number;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onAddressSelect({
          street: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          country: 'United States',
          latitude: 30.2672,
          longitude: -97.7431,
        })
      }
    >
      Use suggested address
    </button>
  ),
}));

describe('Dashboard onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTimezoneFromCoordinates.mockReturnValue('America/Chicago');

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          business: {
            name: 'Test Salon',
            businessType: 'Salon',
            phone: '',
            email: 'owner@example.com',
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'United States',
            timezone: 'America/New_York',
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ business: { id: 'biz-1' } }),
      } as Response);
  });

  it('keeps timezone hidden and saves the automatic timezone from the confirmed address', async () => {
    render(<DashboardOnboardingPage />);

    await screen.findByRole('heading', { name: /finish your business setup/i });

    expect(screen.queryByLabelText(/timezone/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/business phone/i), {
      target: { value: '(555) 123-4567' },
    });
    fireEvent.click(screen.getByRole('button', { name: /use suggested address/i }));
    fireEvent.click(screen.getByRole('button', { name: /unlock dashboard/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    const saveCall = vi.mocked(global.fetch).mock.calls[1];
    expect(saveCall?.[0]).toBe('/api/business');

    const payload = JSON.parse((saveCall?.[1] as RequestInit).body as string);
    expect(payload).toMatchObject({
      phone: '(555) 123-4567',
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      country: 'United States',
      timezone: 'America/Chicago',
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
