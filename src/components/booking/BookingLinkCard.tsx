'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';

export default function BookingLinkCard() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  // Fetch business info to get slug
  const { data: businessData } = useQuery({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business');
      return res.json();
    },
  });  const business = businessData?.business;
    // Generate booking URL with publicId
  const getBookingUrl = () => {
    if (!business?.publicId) return '';
    
    const currentHost = window.location.hostname;
    const currentPort = window.location.port;
    const protocol = window.location.protocol;
    const port = currentPort ? `:${currentPort}` : '';
    
    // Use /book/publicId format
    return `${protocol}//${currentHost}${port}/book/${business.publicId}`;
  };
  
  const bookingUrl = getBookingUrl();

  const handleCopy = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!business) {
    return null;
  }  return (
    <div className="card p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
            Your Booking Page
          </h3>
          <p className="text-xs sm:text-sm text-gray-600">
            Share this link with customers to let them book appointments online
          </p>
          {business.publicId && (
            <p className="text-xs text-gray-500 mt-1">
              Business ID: <span className="font-mono font-semibold text-primary">{business.publicId}</span>
            </p>
          )}
        </div>
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={bookingUrl}
          readOnly
          className="flex-1 px-3 sm:px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 focus:outline-none truncate"
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          Preview
        </a>        <button
          onClick={() => {
            const subject = encodeURIComponent('Book an appointment');
            const body = encodeURIComponent(`Book your appointment here: ${bookingUrl}`);
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
          }}
          className="flex-1 text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          Email
        </button>
        <button
          onClick={() => {
            const text = encodeURIComponent(`Book your appointment here: ${bookingUrl}`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
          }}
          className="flex-1 text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          WhatsApp
        </button>
      </div>
    </div>
  );
}
