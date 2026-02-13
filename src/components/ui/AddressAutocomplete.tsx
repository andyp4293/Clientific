'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

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

export default function AddressAutocomplete({
  onAddressSelect,
  defaultValue = '',
  className = '',
  placeholder = 'Start typing your address...',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // If no API key, just use regular input
    if (!apiKey) {
      console.warn('Google Maps API key not found. Address autocomplete disabled.');
      return;
    }

    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places'],
    });

    loader
      .load()
      .then(() => {
        setIsLoaded(true);
        if (inputRef.current && window.google) {
          const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            types: ['address'],
            componentRestrictions: { country: ['us', 'ca'] }, // US and Canada
            fields: ['address_components', 'formatted_address'],
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();

            if (!place.address_components) {
              return;
            }

            const addressComponents: AddressComponents = {
              street: '',
              city: '',
              state: '',
              zipCode: '',
              country: '',
            };

            let streetNumber = '';
            let route = '';

            place.address_components.forEach((component) => {
              const types = component.types;

              if (types.includes('street_number')) {
                streetNumber = component.long_name;
              } else if (types.includes('route')) {
                route = component.long_name;
              } else if (types.includes('locality')) {
                addressComponents.city = component.long_name;
              } else if (types.includes('administrative_area_level_1')) {
                addressComponents.state = component.short_name;
              } else if (types.includes('postal_code')) {
                addressComponents.zipCode = component.long_name;
              } else if (types.includes('country')) {
                addressComponents.country = component.long_name;
              }
            });

            // Combine street number and route
            addressComponents.street = `${streetNumber} ${route}`.trim();

            // Update input value
            setInputValue(addressComponents.street);

            // Call parent callback
            onAddressSelect(addressComponents);
          });
        }
      })
      .catch((error) => {
        console.error('Error loading Google Maps API:', error);
      });
  }, [onAddressSelect]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isLoaded && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
