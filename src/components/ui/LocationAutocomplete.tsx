'use client';

import { useEffect, useRef, useState } from 'react';

interface MapboxContextItem {
  id: string;
  text: string;
}

interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  place_type?: string[];
  context?: MapboxContextItem[];
}

interface LocationOption {
  id: string;
  label: string;
  value: string;
  subtitle: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

function buildOption(feature: MapboxFeature): LocationOption {
  const primaryType = feature.place_type?.[0] ?? '';
  const region = feature.context?.find((item) => item.id.startsWith('region'))?.text;

  const value = feature.text.trim();
  let label = feature.place_name;
  if (primaryType === 'place' || primaryType === 'locality' || primaryType === 'district') {
    label = region ? `${feature.text}, ${region}` : feature.text;
  } else if (primaryType === 'postcode') {
    label = region ? `${feature.text} (${region})` : feature.text;
  }

  return {
    id: feature.id,
    value,
    label,
    subtitle: feature.place_name,
  };
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'City or ZIP code',
  className = '',
  inputClassName = '',
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 2 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=place,postcode,district,locality,region&autocomplete=true&limit=6&country=us`
      );
      const data = await response.json();
      const options = ((data.features ?? []) as MapboxFeature[]).map(buildOption);
      setSuggestions(options);
      setIsOpen(options.length > 0);
    } catch {
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (nextValue: string) => {
    onChange(nextValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(nextValue.trim());
    }, 250);
  };

  const handleSelect = (option: LocationOption) => {
    onChange(option.value);
    onSelect?.(option.value);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => value.trim().length >= 2 && suggestions.length > 0 && setIsOpen(true)}
        className={inputClassName || 'input'}
        placeholder={placeholder}
        autoComplete="off"
      />

      {isLoading && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          {suggestions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option)}
              className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:hover:bg-gray-800 dark:focus:bg-gray-800"
            >
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{option.subtitle}</div>
            </button>
          ))}
        </div>
      )}

      {isMounted && !MAPBOX_TOKEN && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          Location suggestions are unavailable until the Mapbox token is configured.
        </p>
      )}
    </div>
  );
}
