'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';

export default function BookingLinkCard() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const { data: businessData } = useQuery({
    queryKey: ['business-info'],
    queryFn: async () => {
      const res = await fetch('/api/business');
      if (!res.ok) throw new Error('Failed to fetch business');
      return res.json();
    },
  });

  const business = businessData?.business;

  const getBookingUrl = () => {
    if (!business?.publicId) return '';
    const currentHost = window.location.hostname;
    const currentPort = window.location.port;
    const protocol = window.location.protocol;
    const port = currentPort ? `:${currentPort}` : '';
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

  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booking-qr.png';
    a.click();
  };

  if (!business) return null;

  return (
    <div className="card p-4 sm:p-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Your Booking Page
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Share this link with customers to let them book appointments online
          </p>
          {business.publicId && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Business ID: <span className="font-mono font-semibold text-primary">{business.publicId}</span>
            </p>
          )}
        </div>
        <a
          href={bookingUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/40 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors flex-shrink-0"
        >
          Preview
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* URL + Copy row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          type="text"
          value={bookingUrl}
          readOnly
          className="flex-1 px-3 sm:px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs sm:text-sm text-gray-700 dark:text-gray-300 focus:outline-none truncate"
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap"
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

      {/* QR toggle button */}
      {bookingUrl && (
        <button
          onClick={() => setShowQr(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5V16M4 4h4v4H4V4zm12 0h4v4h-4V4zm0 12h4v4h-4v-4zM4 16h4v4H4v-4z" />
          </svg>
          {showQr ? 'Hide QR Code' : 'Show QR Code'}
        </button>
      )}

      {/* QR expanded section */}
      {showQr && bookingUrl && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div ref={qrRef} className="bg-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm shrink-0">
              <QRCodeCanvas value={bookingUrl} size={140} level="M" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Booking QR Code</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                Customers point their phone camera at this code to open your booking page instantly. No typing, no searching. Print it on receipts, appointment reminder cards, or your front desk display to make booking effortless.
              </p>
              <button
                onClick={handleDownloadQr}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
