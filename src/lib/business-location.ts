import { timezoneFromCoordinates } from '@/lib/timezone';

export interface BusinessAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
}

export interface BusinessAddressCoordinates {
  latitude?: number | null;
  longitude?: number | null;
}

export const BUSINESS_ADDRESS_FIELDS = [
  'street',
  'city',
  'state',
  'zipCode',
  'country',
] as const;

export function buildBusinessAddressQuery(address: BusinessAddress): string {
  return [
    address.street?.trim(),
    address.city?.trim(),
    address.state?.trim(),
    address.zipCode?.trim(),
    address.country?.trim(),
  ]
    .filter(Boolean)
    .join(', ');
}

function hasCoordinates(
  coordinates: BusinessAddressCoordinates | null | undefined
): coordinates is { latitude: number; longitude: number } {
  return Boolean(
    coordinates &&
      Number.isFinite(coordinates.latitude) &&
      Number.isFinite(coordinates.longitude)
  );
}

export async function resolveBusinessAddressTimezone({
  address,
  coordinates,
  fallbackTimezone,
  mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
  fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
}: {
  address: BusinessAddress;
  coordinates?: BusinessAddressCoordinates | null;
  fallbackTimezone: string;
  mapboxToken?: string;
  fetchImpl?: typeof fetch | null;
}): Promise<string> {
  if (hasCoordinates(coordinates)) {
    return (
      timezoneFromCoordinates(coordinates.latitude, coordinates.longitude) ||
      fallbackTimezone
    );
  }

  const addressQuery = buildBusinessAddressQuery(address);
  if (!mapboxToken || !addressQuery || !fetchImpl) {
    return fallbackTimezone;
  }

  try {
    const response = await fetchImpl(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${mapboxToken}&types=address&limit=1&country=us,ca`
    );
    const payload = await response.json().catch(() => ({}));
    const center = Array.isArray(payload?.features?.[0]?.center)
      ? payload.features[0].center
      : null;

    if (Array.isArray(center) && center.length === 2) {
      const [longitude, latitude] = center;
      return timezoneFromCoordinates(latitude, longitude) || fallbackTimezone;
    }
  } catch {
    // Fall through to the stored/browser timezone.
  }

  return fallbackTimezone;
}
