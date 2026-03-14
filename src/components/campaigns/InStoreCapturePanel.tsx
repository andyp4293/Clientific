'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, ExternalLink, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

type DealOption = {
  id: string;
  title: string;
  startsAt: string;
  expiresAt: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
};

type BusinessInfo = {
  name: string;
  publicId: string;
};

type InStoreCapturePanelProps = {
  business: BusinessInfo | null;
  deals: DealOption[];
};

export default function InStoreCapturePanel({
  business,
  deals,
}: InStoreCapturePanelProps) {
  const [selectedDealId, setSelectedDealId] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);

  const activeDeals = useMemo(() => {
    const now = Date.now();
    return deals.filter((deal) => {
      const startsAt = new Date(deal.startsAt).getTime();
      const expiresAt = new Date(deal.expiresAt).getTime();
      const hasInventory =
        deal.maxRedemptions === null || deal.redemptionCount < deal.maxRedemptions;
      return deal.active && startsAt <= now && expiresAt > now && hasInventory;
    });
  }, [deals]);

  useEffect(() => {
    if (selectedDealId && !activeDeals.some((deal) => deal.id === selectedDealId)) {
      setSelectedDealId('');
    }
  }, [activeDeals, selectedDealId]);

  const captureUrl =
    typeof window !== 'undefined' && business?.publicId
      ? `${window.location.origin}/capture/${business.publicId}${selectedDealId ? `?deal=${selectedDealId}` : ''}`
      : '';

  function copyLink() {
    if (!captureUrl) return;
    navigator.clipboard.writeText(captureUrl);
    toast.success('In-store capture link copied');
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedDealId ? 'clientific-promo-kiosk-qr.png' : 'clientific-vip-kiosk-qr.png';
    a.click();
  }

  return (
    <div className="card p-5 md:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">In-Store Capture</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Launch a full-screen device signup page for walk-in service promos and SMS list growth.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="in-store-capture-deal"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
            >
              Promo shown on device
            </label>
            <select
              id="in-store-capture-deal"
              className="input text-sm"
              value={selectedDealId}
              onChange={(event) => setSelectedDealId(event.target.value)}
              disabled={!business}
            >
              <option value="">General VIP signup only</option>
              {activeDeals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {activeDeals.length > 0
                ? 'Only currently active deals appear here. The selected deal is baked into the kiosk URL.'
                : 'No active deals right now. The device can still collect general SMS opt-ins.'}
            </p>
          </div>

          <div>
            <label
              htmlFor="in-store-capture-link"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2"
            >
              Device link
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="in-store-capture-link"
                readOnly
                value={captureUrl}
                className="input flex-1 text-sm"
                placeholder={business ? 'Generating kiosk link...' : 'Business profile still loading...'}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={!captureUrl}
                  className="btn-secondary text-sm"
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy
                </button>
                <a
                  href={captureUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`btn-primary text-sm ${!captureUrl ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  Open
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Front-desk setup
            </p>
            <ol className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <li>1. Open this link on the device and add it to the Home Screen or app launcher.</li>
              <li>2. Turn on Guided Access or your device's kiosk mode so customers stay on the capture page.</li>
              <li>3. After each signup, the success screen resets after 15 seconds, or you can reset it immediately.</li>
            </ol>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-5 text-center dark:border-gray-800 dark:bg-gray-950/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            QR launch
          </p>
          {captureUrl ? (
            <>
              <div
                ref={qrRef}
                className="mx-auto mt-4 inline-flex rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700"
              >
                <QRCodeCanvas value={captureUrl} size={180} level="M" />
              </div>
              <button type="button" onClick={downloadQr} className="mt-4 text-sm font-semibold text-primary hover:text-primary/80">
                <Download className="mr-1 inline h-4 w-4" />
                Download QR
              </button>
            </>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-gray-300 px-4 py-10 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Waiting for business profile data...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
