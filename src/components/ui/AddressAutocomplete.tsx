'use client';

import { useState, useEffect, useRef } from 'react';

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

interface AddressAutocompleteProps {
  onAddressSelect: (address: AddressComponents) => void;
  defaultValue?: string;
  value?: string;
  onInputChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
}

interface MapboxFeature {
  place_name: string;
  text: string;
  center?: [number, number];
  context?: Array<{
    id: string;
    text: string;
  }>;
  address?: string;
}

export default function AddressAutocomplete({
  onAddressSelect,
  defaultValue = '',
  value,
  onInputChange,
  className = '',
  placeholder = 'Start typing your address...',
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  // Handle client-side mounting
  useEffect(() => {
    setIsMounted(true);
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value);
      return;
    }

    setInputValue(defaultValue);
  }, [defaultValue, value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3 || !MAPBOX_TOKEN) {
      if (mountedRef.current) {
        setSuggestions([]);
      }
      return;
    }

    if (mountedRef.current) {
      setIsLoading(true);
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=address&autocomplete=true&limit=5&country=us,ca`
      );
      
      const data = await response.json();
      if (!mountedRef.current) return;

      setSuggestions(data.features || []);
      setIsOpen(true);
    } catch (error) {
      console.error('Mapbox API error:', error);
      if (mountedRef.current) {
        setSuggestions([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onInputChange?.(value);

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleSelectAddress = (feature: MapboxFeature) => {
    setIsOpen(false);

    // Parse address components from Mapbox response
    let street = '';
    let city = '';
    let state = '';
    let zipCode = '';
    let country = '';

    // Street number + street name (just the street, not full address)
    if (feature.address && feature.text) {
      street = `${feature.address} ${feature.text}`;
    } else if (feature.text) {
      street = feature.text;
    }

    // Parse context for other components
    feature.context?.forEach((item) => {
      if (item.id.startsWith('place')) {
        city = item.text;
      } else if (item.id.startsWith('region')) {
        state = item.text;
      } else if (item.id.startsWith('postcode')) {
        zipCode = item.text;
      } else if (item.id.startsWith('country')) {
        country = item.text;
      }
    });

    const latitude = Array.isArray(feature.center) ? feature.center[1] : undefined;
    const longitude = Array.isArray(feature.center) ? feature.center[0] : undefined;

    // Set input value to just the street address, not the full place_name
    setInputValue(street);

    onAddressSelect({
      street,
      city,
      state,
      zipCode,
      country,
      latitude,
      longitude,
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value ?? inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => inputValue.length >= 3 && setIsOpen(true)}
        className={className || 'input'}
        placeholder={placeholder}
        autoComplete="off"
      />
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {suggestions.map((feature, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectAddress(feature)}
              className="w-full px-4 py-2 text-left transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:hover:bg-gray-800 dark:focus:bg-gray-800"
            >
              <div className="text-sm text-gray-900 dark:text-gray-100">{feature.place_name}</div>
            </button>
          ))}
        </div>
      )}

      {isMounted && !MAPBOX_TOKEN && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          Mapbox token not configured. Address autocomplete is disabled.
        </p>
      )}
    </div>
  );
}
