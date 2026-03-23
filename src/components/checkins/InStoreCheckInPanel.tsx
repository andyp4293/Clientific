'use client';

import { useMemo, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, ExternalLink, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

type BusinessInfo = {
  name: string;
  publicId: string;
};

type InStoreCheckInPanelProps = {
  business: BusinessInfo | null;
};

export default function InStoreCheckInPanel({ business }: InStoreCheckInPanelProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const checkInUrl = useMemo(() => {
    if (typeof window === 'undefined' || !business?.publicId) return '';
    return `${window.location.origin}/check-in/${business.publicId}`;
  }, [business?.publicId]);

  function copyLink() {
    if (!checkInUrl) return;
    navigator.clipboard.writeText(checkInUrl);
    toast.success('In-store check-in link copied');
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientific-check-in-kiosk-qr.png';
    a.click();
  }

  return (
    <section className="card rounded-[30px] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
            In-store check-in
          </p>
          <h2 className="mt-2 text-xl font-semibold text-gray-950 dark:text-white">
            Launch a front-desk check-in link on any device
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Guests type just their phone number on the device. Existing customers move straight to a thank-you screen,
            and new guests only add their name once.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="in-store-checkin-link"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400"
            >
              Device link
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="in-store-checkin-link"
                readOnly
                value={checkInUrl}
                className="input flex-1 text-sm"
                placeholder={business ? 'Generating front-desk link...' : 'Business profile still loading...'}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={!checkInUrl}
                  className="btn-secondary text-sm"
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy
                </button>
                <a
                  href={checkInUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`btn-primary text-sm ${!checkInUrl ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  Open
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
              Front-desk setup
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
              <li>1. Open this link on the front-desk phone, tablet, or kiosk device.</li>
              <li>2. Add it to the Home Screen or app launcher so staff can reopen it quickly.</li>
              <li>3. Guests enter only their mobile number, then Clientific handles the rest.</li>
            </ol>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-5 text-center dark:border-gray-800 dark:bg-gray-950/30">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400">
            QR launch
          </p>
          {checkInUrl ? (
            <>
              <div
                ref={qrRef}
                className="mx-auto mt-4 inline-flex rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700"
              >
                <QRCodeCanvas value={checkInUrl} size={180} level="M" />
              </div>
              <button
                type="button"
                onClick={downloadQr}
                className="mt-4 text-sm font-semibold text-primary hover:text-primary/80"
              >
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
    </section>
  );
}
