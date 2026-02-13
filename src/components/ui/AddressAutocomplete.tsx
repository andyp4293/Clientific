'use client';

import { useState, useEffect, useRef } from 'react';

interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface AddressAutocompleteProps {
  onAddressSelect: (address: AddressComponents) => void;
  defaultValue?: string;
  className?: string;
  placeholder?: string;
}

interface MapboxFeature {
  place_name: string;
  text: string;
  context?: Array<{
    id: string;
    text: string;
  }>;
  address?: string;
}

export default function AddressAutocomplete({
  onAddressSelect,
  defaultValue = '',
  className = '',
  placeholder = 'Start typing your address...',
}: AddressAutocompleteProps) {  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

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
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=address&autocomplete=true&limit=5&country=us,ca`
      );
      
      const data = await response.json();
      setSuggestions(data.features || []);
      setIsOpen(true);
    } catch (error) {
      console.error('Mapbox API error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  const handleSelectAddress = (feature: MapboxFeature) => {
    setInputValue(feature.place_name);
    setIsOpen(false);

    // Parse address components from Mapbox response
    let street = '';
    let city = '';
    let state = '';
    let zipCode = '';
    let country = '';

    // Street number + street name
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

    onAddressSelect({ street, city, state, zipCode, country });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={inputValue}
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((feature, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectAddress(feature)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
            >
              <div className="text-sm text-gray-900">{feature.place_name}</div>
            </button>
          ))}
        </div>
      )}

      {!MAPBOX_TOKEN && (
        <p className="text-xs text-red-500 mt-1">
          Mapbox token not configured. Address autocomplete is disabled.
        </p>
      )}
    </div>
  );
}
