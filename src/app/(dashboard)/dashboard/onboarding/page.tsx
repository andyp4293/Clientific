'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AddressAutocomplete, { type AddressComponents } from '@/components/ui/AddressAutocomplete';
import { timezoneFromCoordinates } from '@/lib/timezone';

type OnboardingFormData = {
  name: string;
  businessType: string;
  phone: string;
  businessEmail: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  timezone: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

const EMPTY_FORM: OnboardingFormData = {
  name: '',
  businessType: '',
  phone: '',
  businessEmail: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'United States',
  timezone: '',
};

const ADDRESS_FIELDS: Array<keyof OnboardingFormData> = [
  'street',
  'city',
  'state',
  'zipCode',
  'country',
];

function hasCoordinates(value: Coordinates | null): value is Coordinates {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude)
  );
}

export default function DashboardOnboardingPage() {
  const router = useRouter();
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    []
  );
  const [formData, setFormData] = useState<OnboardingFormData>(EMPTY_FORM);
  const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBusiness = async () => {
      setIsLoading(true);
      setError('');

      try {
        const res = await fetch('/api/business');
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(body.error || 'Failed to load business details');
        }

        const business = body.business;

        setFormData({
          name: business.name ?? '',
          businessType: business.businessType ?? '',
          phone: business.phone ?? '',
          businessEmail: business.businessEmail ?? business.email ?? '',
          street: business.street ?? '',
          city: business.city ?? '',
          state: business.state ?? '',
          zipCode: business.zipCode ?? '',
          country: business.country ?? 'United States',
          timezone: business.timezone || browserTimezone,
        });
      } catch (fetchError: any) {
        setError(fetchError?.message || 'Failed to load business details');
      } finally {
        setIsLoading(false);
      }
    };

    void loadBusiness();
  }, [browserTimezone]);

  const phoneReady = useMemo(
    () => formData.phone.replace(/\D/g, '').length >= 10,
    [formData.phone]
  );
  const addressReady = Boolean(
    formData.street.trim() &&
      formData.city.trim() &&
      formData.state.trim() &&
      formData.zipCode.trim() &&
      formData.country.trim()
  );

  const updateField = (field: keyof OnboardingFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));

    if (ADDRESS_FIELDS.includes(field)) {
      setSelectedCoordinates(null);
    }
  };

  const handleAddressSelect = (address: AddressComponents) => {
    const timezone =
      typeof address.latitude === 'number' && typeof address.longitude === 'number'
        ? timezoneFromCoordinates(address.latitude, address.longitude)
        : null;

    setSelectedCoordinates(
      typeof address.latitude === 'number' && typeof address.longitude === 'number'
        ? { latitude: address.latitude, longitude: address.longitude }
        : null
    );

    setFormData((current) => ({
      ...current,
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country || current.country || 'United States',
      timezone: timezone || current.timezone || browserTimezone,
    }));
  };

  const resolveTimezoneForAddress = async (): Promise<string> => {
    if (hasCoordinates(selectedCoordinates)) {
      return (
        timezoneFromCoordinates(selectedCoordinates.latitude, selectedCoordinates.longitude) ||
        formData.timezone ||
        browserTimezone
      );
    }

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const addressQuery = [
      formData.street.trim(),
      formData.city.trim(),
      formData.state.trim(),
      formData.zipCode.trim(),
      formData.country.trim(),
    ]
      .filter(Boolean)
      .join(', ');

    if (mapboxToken && addressQuery) {
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${mapboxToken}&types=address&limit=1&country=us,ca`
        );
        const payload = await response.json().catch(() => ({}));
        const center = Array.isArray(payload?.features?.[0]?.center)
          ? payload.features[0].center
          : null;

        if (Array.isArray(center) && center.length === 2) {
          const [longitude, latitude] = center;
          const timezone = timezoneFromCoordinates(latitude, longitude);
          if (timezone) {
            return timezone;
          }
        }
      } catch {
        // Fall through to the existing stored/browser timezone.
      }
    }

    return formData.timezone || browserTimezone;
  };

  const completeOnboarding = async () => {
    if (!phoneReady) {
      setError('Enter a valid business phone number.');
      return;
    }

    if (!addressReady) {
      setError('Enter your business address to finish setup.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const timezone = await resolveTimezoneForAddress();

      const res = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone.trim(),
          businessEmail: formData.businessEmail.trim() || null,
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zipCode: formData.zipCode.trim(),
          country: formData.country.trim() || 'United States',
          timezone,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Failed to save onboarding details');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to save onboarding details');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading your setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Finish Your Business Setup
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Add your business phone and location to unlock your dashboard, public profile, and local booking flow.
        </p>
      </div>

      <div className="card p-6 md:p-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-primary/20 bg-primary-50 px-4 py-4 text-sm text-gray-700 dark:border-primary/20 dark:bg-primary/10 dark:text-gray-300">
          We will save your local scheduling timezone automatically from the address you confirm here.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="onboarding-business-name" className="label">
              Business Name
            </label>
            <input
              id="onboarding-business-name"
              type="text"
              value={formData.name}
              disabled
              className="input opacity-70 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="onboarding-business-type" className="label">
              Business Type
            </label>
            <input
              id="onboarding-business-type"
              type="text"
              value={formData.businessType}
              disabled
              className="input opacity-70 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="onboarding-phone" className="label">
              Business Phone *
            </label>
            <input
              id="onboarding-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="input"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label htmlFor="onboarding-business-email" className="label">
              Business Email
            </label>
            <input
              id="onboarding-business-email"
              type="email"
              value={formData.businessEmail}
              onChange={(e) => updateField('businessEmail', e.target.value)}
              className="input"
              placeholder="hello@yourbusiness.com"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Find Your Address</label>
            <AddressAutocomplete
              key={`address-${formData.street}`}
              defaultValue={formData.street}
              onAddressSelect={handleAddressSelect}
              className="input"
              placeholder="Start typing your address..."
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Pick a suggestion to autofill the fields below, or enter them manually.
            </p>
          </div>

          <div>
            <label htmlFor="onboarding-street" className="label">
              Street Address *
            </label>
            <input
              id="onboarding-street"
              type="text"
              value={formData.street}
              onChange={(e) => updateField('street', e.target.value)}
              className="input"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="onboarding-city" className="label">
                City *
              </label>
              <input
                id="onboarding-city"
                type="text"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="onboarding-state" className="label">
                State *
              </label>
              <input
                id="onboarding-state"
                type="text"
                value={formData.state}
                onChange={(e) => updateField('state', e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="onboarding-zip" className="label">
                ZIP Code *
              </label>
              <input
                id="onboarding-zip"
                type="text"
                value={formData.zipCode}
                onChange={(e) => updateField('zipCode', e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="onboarding-country" className="label">
                Country *
              </label>
              <input
                id="onboarding-country"
                type="text"
                value={formData.country}
                onChange={(e) => updateField('country', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary-50 px-4 py-4 text-sm text-gray-700 dark:border-primary/20 dark:bg-primary/10 dark:text-gray-300">
          You can change any of this later in Dashboard Settings.
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={completeOnboarding}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : 'Unlock dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
