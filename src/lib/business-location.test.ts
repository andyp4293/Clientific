import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/timezone', () => ({
  timezoneFromCoordinates: vi.fn(),
}));

import { timezoneFromCoordinates } from '@/lib/timezone';
import {
  buildBusinessAddressQuery,
  resolveBusinessAddressTimezone,
} from './business-location';

const mockTimezoneFromCoordinates = timezoneFromCoordinates as ReturnType<typeof vi.fn>;

describe('business location helpers', () => {
  it('builds a geocoding query from trimmed address parts', () => {
    expect(
      buildBusinessAddressQuery({
        street: ' 123 Main St ',
        city: ' Austin ',
        state: ' TX ',
        zipCode: ' 78701 ',
        country: ' United States ',
      })
    ).toBe('123 Main St, Austin, TX, 78701, United States');
  });

  it('uses coordinates first when available', async () => {
    mockTimezoneFromCoordinates.mockReturnValue('America/Chicago');

    const timezone = await resolveBusinessAddressTimezone({
      address: {
        street: '123 Main St',
        city: 'Austin',
        state: 'TX',
      },
      coordinates: { latitude: 30.2672, longitude: -97.7431 },
      fallbackTimezone: 'America/New_York',
      mapboxToken: '',
      fetchImpl: null,
    });

    expect(timezone).toBe('America/Chicago');
    expect(mockTimezoneFromCoordinates).toHaveBeenCalledWith(30.2672, -97.7431);
  });

  it('geocodes manual address edits when coordinates are unavailable', async () => {
    mockTimezoneFromCoordinates.mockReturnValue('America/Denver');
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        features: [{ center: [-104.9903, 39.7392] }],
      }),
    });

    const timezone = await resolveBusinessAddressTimezone({
      address: {
        street: '1701 Wynkoop St',
        city: 'Denver',
        state: 'CO',
        zipCode: '80202',
        country: 'United States',
      },
      fallbackTimezone: 'America/New_York',
      mapboxToken: 'test-token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(timezone).toBe('America/Denver');
    expect(mockTimezoneFromCoordinates).toHaveBeenCalledWith(39.7392, -104.9903);
  });

  it('falls back cleanly when geocoding fails', async () => {
    mockTimezoneFromCoordinates.mockReturnValue(null);
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'));

    const timezone = await resolveBusinessAddressTimezone({
      address: {
        street: '123 Main St',
        city: 'Austin',
        state: 'TX',
      },
      fallbackTimezone: 'America/New_York',
      mapboxToken: 'test-token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(timezone).toBe('America/New_York');
  });
});
